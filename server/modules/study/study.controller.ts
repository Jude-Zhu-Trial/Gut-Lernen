import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type {
  ReviewRequest,
  ReviewResponse,
  StudySettingResponse,
  StudyStatsResponse,
  TodayStudyResponse,
  UpdateSettingRequest,
} from '@shared/api.interface';
import { StudyService } from './study.service';

@Controller('api/study')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get('today')
  async today(@Req() req: Request): Promise<TodayStudyResponse> {
    return this.studyService.getToday(req.userContext.userId);
  }

  @NeedLogin()
  @Post('review')
  async review(
    @Req() req: Request,
    @Body() dto: ReviewRequest,
  ): Promise<ReviewResponse> {
    return this.studyService.review(req.userContext.userId, dto);
  }

  @Get('stats')
  async stats(@Req() req: Request): Promise<StudyStatsResponse> {
    return this.studyService.getStats(req.userContext.userId);
  }

  @Get('settings')
  async getSettings(@Req() req: Request): Promise<StudySettingResponse> {
    return this.studyService.getSettings(req.userContext.userId);
  }

  @NeedLogin()
  @Put('settings')
  async updateSettings(
    @Req() req: Request,
    @Body() dto: UpdateSettingRequest,
  ): Promise<StudySettingResponse> {
    return this.studyService.updateSettings(
      req.userContext.userId,
      dto.dailyNewCount,
    );
  }
}
