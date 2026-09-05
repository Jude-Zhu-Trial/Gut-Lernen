import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { VocabService } from './vocab.service';
import { CreateListDto, CreateWordDto } from './dto/vocab.dto';

@Controller('api/vocab')
export class VocabController {
  constructor(private readonly vocabService: VocabService) {}

  @Get('lists')
  async getLists(@Req() req: Request) {
    const userId: string = req.userContext?.userId ?? '';
    return this.vocabService.getLists(userId);
  }

  @NeedLogin()
  @Post('lists')
  async createList(@Req() req: Request, @Body() dto: CreateListDto) {
    const userId: string = req.userContext?.userId ?? '';
    return this.vocabService.createList(userId, dto);
  }

  @NeedLogin()
  @Delete('lists/:id')
  async deleteList(@Req() req: Request, @Param('id') id: string) {
    const userId: string = req.userContext?.userId ?? '';
    return this.vocabService.deleteList(userId, id);
  }

  @Get('lists/:id/words')
  async getWords(@Param('id') id: string) {
    return this.vocabService.getWords(id);
  }

  @NeedLogin()
  @Post('lists/:id/words')
  async createWord(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateWordDto,
  ) {
    const userId: string = req.userContext?.userId ?? '';
    return this.vocabService.createWord(userId, id, dto);
  }

  @NeedLogin()
  @Delete('words/:id')
  async deleteWord(@Req() req: Request, @Param('id') id: string) {
    const userId: string = req.userContext?.userId ?? '';
    return this.vocabService.deleteWord(userId, id);
  }
}
