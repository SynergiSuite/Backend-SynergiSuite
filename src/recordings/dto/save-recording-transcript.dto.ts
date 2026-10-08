import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SaveRecordingTranscriptDto {
  @IsString()
  @IsNotEmpty()
  transcript: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  segments?: Record<string, any>[];

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
