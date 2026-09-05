import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateListDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateWordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  german!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  chinese!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phonetic?: string;

  @IsOptional()
  @IsString()
  example?: string;

  @IsOptional()
  @IsString()
  exampleCn?: string;
}
