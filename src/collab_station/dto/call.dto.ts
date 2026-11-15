export interface CallParticipantDto {
  user_id: number;
  name: string;
}

export interface CallResponseDto {
  callId: string;
  groupId: string;
  roomName?: string;
  status: string;
  caller: CallParticipantDto;
  recipient: CallParticipantDto;
  createdAt: string;
  answeredAt?: string;
  endedAt?: string;
}

export interface CallTokenResponseDto {
  token: string;
  url: string;
}

export interface CallAckSuccess {
  success: true;
  call: CallResponseDto;
  delivery?: {
    recipientOnline: boolean;
    recipientSocketCount: number;
  };
}

export interface CallAckError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type CallAckDto = CallAckSuccess | CallAckError;

export function toCallResponseDto(call: any): CallResponseDto {
  return {
    callId: call.id,
    groupId: call.groupId,
    roomName: call.livekitRoomName,
    status: call.status,
    caller: {
      user_id: call.caller?.user_id ?? call.callerId,
      name: call.caller?.name ?? 'Unknown',
    },
    recipient: {
      user_id: call.recipient?.user_id ?? call.recipientId,
      name: call.recipient?.name ?? 'Unknown',
    },
    createdAt:
      call.createdAt instanceof Date
        ? call.createdAt.toISOString()
        : call.createdAt,
    answeredAt: call.answeredAt
      ? call.answeredAt instanceof Date
        ? call.answeredAt.toISOString()
        : call.answeredAt
      : undefined,
    endedAt: call.endedAt
      ? call.endedAt instanceof Date
        ? call.endedAt.toISOString()
        : call.endedAt
      : undefined,
  };
}
