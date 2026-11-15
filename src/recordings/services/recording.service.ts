import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EgressClient,
  EgressInfo,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
  WebhookEvent,
  WebhookReceiver,
} from 'livekit-server-sdk';
import { In, IsNull, Repository } from 'typeorm';
import {
  MeetingRecording,
  MeetingRecordingStatus,
} from '../entities/meeting-recording.entity';
import { MinIO } from '../../minIO/minIO.service';
import { SaveRecordingTranscriptDto } from '../dto/save-recording-transcript.dto';

const ACTIVE_RECORDING_STATUSES = [
  MeetingRecordingStatus.STARTING,
  MeetingRecordingStatus.ACTIVE,
  MeetingRecordingStatus.ENDING,
];
const RECORDING_PLAYBACK_URL_EXPIRY_SECONDS = 60 * 60;

@Injectable()
export class RecordingService implements OnModuleInit {
  private readonly logger = new Logger(RecordingService.name);

  constructor(
    @InjectRepository(MeetingRecording)
    private readonly recordingRepository: Repository<MeetingRecording>,
    private readonly minioService: MinIO,
  ) {}

  onModuleInit() {
    const missing = this.getMissingConfig();
    if (missing.length) {
      this.logger.warn(
        `Missing recording configuration: ${missing.join(', ')}. Automatic meeting recording will not work.`,
      );
      return;
    }

    this.logger.log('Recording configuration validated');
  }

  async receiveLiveKitWebhook(
    rawBody: string,
    authorization?: string,
  ): Promise<WebhookEvent> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const webhookSecret =
      process.env.LIVEKIT_WEBHOOK_SECRET || process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !webhookSecret) {
      throw new HttpException(
        'LiveKit webhook verification is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const receiver = new WebhookReceiver(apiKey, webhookSecret);
    return receiver.receive(rawBody, authorization);
  }

  async handleWebhookEvent(event: WebhookEvent) {
    if (event.event === 'room_started') {
      await this.handleRoomStarted(event.room?.name);
      return;
    }

    if (event.event === 'room_finished') {
      await this.handleRoomFinished(event.room?.name);
      return;
    }

    if (event.event === 'egress_ended') {
      await this.handleEgressEnded(event.egressInfo);
    }
  }

  async getLatestRecording(roomName: string) {
    const recording = await this.recordingRepository.findOne({
      where: { roomName },
      order: { createdAt: 'DESC' },
    });

    if (!recording) {
      throw new HttpException('Recording not found', HttpStatus.NOT_FOUND);
    }

    return this.toResponse(recording, true);
  }

  async getRecordingsForRooms(roomNames: string[]) {
    if (!roomNames.length) {
      return [];
    }

    const recordings = await this.recordingRepository.find({
      where: { roomName: In(roomNames) },
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      recordings.map((recording) => this.toResponse(recording, true)),
    );
  }

  async stopActiveRecording(roomName: string) {
    const recording = await this.findActiveRecording(roomName);
    if (!recording) {
      throw new HttpException(
        'No active recording found for this room',
        HttpStatus.NOT_FOUND,
      );
    }

    this.logger.log(
      `Stopping LiveKit egress. roomName=${roomName}, egressId=${recording.egressId}`,
    );

    try {
      const egressInfo = await this.getEgressClient().stopEgress(
        recording.egressId,
      );
      await this.applyEgressInfo(recording, egressInfo);
      return this.toResponse(recording, true);
    } catch (error) {
      this.logger.error(
        `Failed to stop LiveKit egress. roomName=${roomName}, egressId=${recording.egressId}, error=${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to stop recording',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getPlaybackUrl(roomName: string) {
    const recording = await this.recordingRepository.findOne({
      where: { roomName },
      order: { createdAt: 'DESC' },
    });

    if (!recording?.filePath) {
      throw new HttpException(
        'Recording file is not available yet',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.minioService.generateViewUrl(
      recording.filePath,
      recording.bucket,
      RECORDING_PLAYBACK_URL_EXPIRY_SECONDS,
    );
  }

  async getTranscript(roomName: string) {
    const recording = await this.findLatestRecordingOrFail(roomName);
    return this.toTranscriptResponse(recording, false);
  }

  async saveTranscript(roomName: string, dto: SaveRecordingTranscriptDto) {
    const recording = await this.findLatestRecordingOrFail(roomName);

    if (recording.transcriptGeneratedAt && recording.transcript) {
      return this.toTranscriptResponse(recording, true);
    }

    const updateResult = await this.recordingRepository.update(
      { id: recording.id, transcriptGeneratedAt: IsNull() },
      {
        transcript: dto.transcript,
        transcriptSegments: dto.segments || null,
        transcriptLanguage: dto.language || null,
        transcriptProvider: dto.provider || null,
        transcriptGeneratedAt: new Date(),
      },
    );

    const saved = await this.findLatestRecordingOrFail(roomName);
    if (!updateResult.affected) {
      return this.toTranscriptResponse(saved, true);
    }

    this.logger.log(
      `Recording transcript saved. roomName=${roomName}, recordingId=${saved.id}`,
    );

    return this.toTranscriptResponse(saved, false);
  }

  private async handleRoomStarted(roomName?: string) {
    if (!roomName) {
      this.logger.warn('room_started webhook received without room name');
      return;
    }

    const existing = await this.findActiveRecording(roomName);
    if (existing) {
      this.logger.log(
        `Recording already active for room. roomName=${roomName}, egressId=${existing.egressId}`,
      );
      return;
    }

    const config = this.getConfig();
    const filePath = this.buildRecordingFilePath(roomName);
    const recording = this.recordingRepository.create({
      roomName,
      bucket: config.bucket,
      filePath,
      status: MeetingRecordingStatus.STARTING,
    });
    await this.recordingRepository.save(recording);

    this.logger.log(`Starting LiveKit egress. roomName=${roomName}`);

    try {
      await this.minioService.ensureBucket(config.bucket);

      const fileOutput = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: filePath,
        output: {
          case: 's3',
          value: new S3Upload({
            endpoint: config.minioEndpoint,
            accessKey: config.minioAccessKey,
            secret: config.minioSecretKey,
            bucket: config.bucket,
            forcePathStyle: true,
            region: 'us-east-1',
          }),
        },
      });

      const egressInfo = await this.getEgressClient().startRoomCompositeEgress(
        roomName,
        { file: fileOutput },
        { layout: config.layout },
      );

      await this.applyEgressInfo(recording, egressInfo);
      this.logger.log(
        `LiveKit egress started. roomName=${roomName}, egressId=${recording.egressId}`,
      );
    } catch (error) {
      recording.status = MeetingRecordingStatus.FAILED;
      recording.error = error.message;
      await this.recordingRepository.save(recording);
      this.logger.error(
        `Failed to start LiveKit egress. roomName=${roomName}, error=${error.message}`,
        error.stack,
      );
    }
  }

  private async handleRoomFinished(roomName?: string) {
    if (!roomName) {
      this.logger.warn('room_finished webhook received without room name');
      return;
    }

    const recording = await this.findActiveRecording(roomName);
    if (!recording) {
      this.logger.log(`No active egress to stop. roomName=${roomName}`);
      return;
    }

    this.logger.log(
      `Room finished; stopping egress safety net. roomName=${roomName}, egressId=${recording.egressId}`,
    );

    try {
      const egressInfo = await this.getEgressClient().stopEgress(
        recording.egressId,
      );
      await this.applyEgressInfo(recording, egressInfo);
    } catch (error) {
      this.logger.error(
        `Failed to stop egress after room_finished. roomName=${roomName}, egressId=${recording.egressId}, error=${error.message}`,
        error.stack,
      );
    }
  }

  private async handleEgressEnded(egressInfo?: EgressInfo) {
    if (!egressInfo?.egressId) {
      this.logger.warn('egress_ended webhook received without egressId');
      return;
    }

    const recording = await this.recordingRepository.findOne({
      where: { egressId: egressInfo.egressId },
    });

    if (!recording) {
      this.logger.warn(
        `egress_ended received for unknown egressId=${egressInfo.egressId}`,
      );
      return;
    }

    await this.applyEgressInfo(recording, egressInfo);
    this.logger.log(
      `Egress ended. roomName=${recording.roomName}, egressId=${recording.egressId}, status=${recording.status}`,
    );
  }

  private async applyEgressInfo(
    recording: MeetingRecording,
    egressInfo: EgressInfo,
  ) {
    recording.egressId = egressInfo.egressId || recording.egressId;
    recording.roomName = egressInfo.roomName || recording.roomName;
    recording.status = this.toRecordingStatus(egressInfo.status);
    recording.error = egressInfo.error || egressInfo.details || recording.error;
    recording.startedAt = this.fromLiveKitTimestamp(egressInfo.startedAt);
    recording.endedAt = this.fromLiveKitTimestamp(egressInfo.endedAt);
    recording.metadata = egressInfo.toJson
      ? (egressInfo.toJson() as Record<string, any>)
      : recording.metadata;

    const fileResult = egressInfo.fileResults?.[0];
    if (fileResult) {
      recording.filePath = fileResult.filename || recording.filePath;
      recording.fileLocation = fileResult.location || recording.fileLocation;
      recording.fileSize = fileResult.size
        ? fileResult.size.toString()
        : recording.fileSize;
      recording.duration = fileResult.duration
        ? fileResult.duration.toString()
        : recording.duration;
    }

    await this.recordingRepository.save(recording);
  }

  private async findActiveRecording(roomName: string) {
    return this.recordingRepository
      .createQueryBuilder('recording')
      .where('recording.roomName = :roomName', { roomName })
      .andWhere('recording.status IN (:...statuses)', {
        statuses: ACTIVE_RECORDING_STATUSES,
      })
      .orderBy('recording.createdAt', 'DESC')
      .getOne();
  }

  private async findLatestRecordingOrFail(roomName: string) {
    const recording = await this.recordingRepository.findOne({
      where: { roomName },
      order: { createdAt: 'DESC' },
    });

    if (!recording) {
      throw new HttpException('Recording not found', HttpStatus.NOT_FOUND);
    }

    return recording;
  }

  private getEgressClient() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new HttpException(
        'LiveKit is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return new EgressClient(
      this.toHttpLiveKitUrl(livekitUrl),
      apiKey,
      apiSecret,
    );
  }

  private getConfig() {
    const minioEndpoint =
      process.env.MINIO_ENDPOINT ||
      process.env.AWS_S3_PUBLIC_ENDPOINT ||
      process.env.AWS_S3_ENDPOINT;
    const minioAccessKey =
      process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
    const minioSecretKey =
      process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const bucket = process.env.MINIO_BUCKET || 'recordings';
    const layout = process.env.LIVEKIT_RECORDING_LAYOUT || 'speaker';

    if (!minioEndpoint || !minioAccessKey || !minioSecretKey) {
      throw new HttpException(
        'MinIO recording storage is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      minioEndpoint,
      minioAccessKey,
      minioSecretKey,
      bucket,
      layout,
    };
  }

  private getMissingConfig(): string[] {
    const missing = [
      'LIVEKIT_URL',
      'LIVEKIT_API_KEY',
      'LIVEKIT_API_SECRET',
    ].filter((key) => !process.env[key]);

    if (
      !process.env.MINIO_ENDPOINT &&
      !process.env.AWS_S3_PUBLIC_ENDPOINT &&
      !process.env.AWS_S3_ENDPOINT
    ) {
      missing.push('MINIO_ENDPOINT');
    }

    if (!process.env.MINIO_ACCESS_KEY && !process.env.AWS_ACCESS_KEY_ID) {
      missing.push('MINIO_ACCESS_KEY');
    }

    if (!process.env.MINIO_SECRET_KEY && !process.env.AWS_SECRET_ACCESS_KEY) {
      missing.push('MINIO_SECRET_KEY');
    }

    return missing;
  }

  private toRecordingStatus(status: EgressStatus): MeetingRecordingStatus {
    switch (status) {
      case EgressStatus.EGRESS_STARTING:
        return MeetingRecordingStatus.STARTING;
      case EgressStatus.EGRESS_ACTIVE:
        return MeetingRecordingStatus.ACTIVE;
      case EgressStatus.EGRESS_ENDING:
        return MeetingRecordingStatus.ENDING;
      case EgressStatus.EGRESS_COMPLETE:
        return MeetingRecordingStatus.COMPLETE;
      case EgressStatus.EGRESS_FAILED:
        return MeetingRecordingStatus.FAILED;
      case EgressStatus.EGRESS_ABORTED:
        return MeetingRecordingStatus.ABORTED;
      case EgressStatus.EGRESS_LIMIT_REACHED:
        return MeetingRecordingStatus.LIMIT_REACHED;
      default:
        return MeetingRecordingStatus.UNKNOWN;
    }
  }

  private fromLiveKitTimestamp(value?: bigint): Date | null {
    if (!value || value === BigInt(0)) {
      return null;
    }

    return new Date(Number(value) / 1000000);
  }

  private toHttpLiveKitUrl(url: string) {
    if (url.startsWith('wss://')) {
      return url.replace('wss://', 'https://');
    }

    if (url.startsWith('ws://')) {
      return url.replace('ws://', 'http://');
    }

    return url;
  }

  private buildRecordingFilePath(roomName: string) {
    const safeRoomName = roomName.replace(/[^a-zA-Z0-9._-]/g, '-');
    return `recordings/${safeRoomName}-${Date.now()}.mp4`;
  }

  private async toResponse(
    recording: MeetingRecording,
    includePlaybackUrl: boolean = false,
  ) {
    let playbackUrl: string | null = null;
    const playbackUrlExpiresIn = RECORDING_PLAYBACK_URL_EXPIRY_SECONDS;

    if (includePlaybackUrl && recording.filePath) {
      try {
        const result = await this.minioService.generateViewUrl(
          recording.filePath,
          recording.bucket,
          playbackUrlExpiresIn,
        );
        playbackUrl = result.viewUrl;
      } catch (error) {
        this.logger.error(
          `Failed to generate recording playback URL. roomName=${recording.roomName}, filePath=${recording.filePath}, error=${error.message}`,
          error.stack,
        );
      }
    }

    return {
      id: recording.id,
      roomName: recording.roomName,
      egressId: recording.egressId,
      status: recording.status,
      bucket: recording.bucket,
      filePath: recording.filePath,
      fileLocation: recording.fileLocation,
      fileSize: recording.fileSize,
      duration: recording.duration,
      error: recording.error,
      transcriptAvailable: !!recording.transcriptGeneratedAt,
      transcriptGeneratedAt: recording.transcriptGeneratedAt,
      transcriptLanguage: recording.transcriptLanguage,
      transcriptProvider: recording.transcriptProvider,
      startedAt: recording.startedAt,
      endedAt: recording.endedAt,
      createdAt: recording.createdAt,
      updatedAt: recording.updatedAt,
      playbackUrl,
      playbackUrlExpiresIn: playbackUrl ? playbackUrlExpiresIn : null,
    };
  }

  private toTranscriptResponse(
    recording: MeetingRecording,
    alreadyExists: boolean,
  ) {
    return {
      recordingId: recording.id,
      roomName: recording.roomName,
      transcriptAvailable: !!recording.transcriptGeneratedAt,
      transcript: recording.transcript,
      segments: recording.transcriptSegments,
      language: recording.transcriptLanguage,
      provider: recording.transcriptProvider,
      generatedAt: recording.transcriptGeneratedAt,
      alreadyExists,
    };
  }
}
