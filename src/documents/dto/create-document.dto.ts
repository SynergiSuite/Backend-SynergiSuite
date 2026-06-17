import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  reference_type: string;

  @IsString()
  @IsNotEmpty()
  reference_id: string;

  @IsString()
  @IsNotEmpty()
  file_path: string;

  @IsString()
  @IsOptional()
  label?: string;
}
