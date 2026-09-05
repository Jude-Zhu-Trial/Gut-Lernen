import type {
  ReviewRequest,
  ReviewResponse,
  StudySettingResponse,
  StudyStatsResponse,
  TodayStudyResponse,
  UpdateSettingRequest,
} from '@shared/api.interface';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export async function getTodayStudy(): Promise<TodayStudyResponse> {
  const response = await axiosForBackend.get<TodayStudyResponse>('/api/study/today');
  return response.data;
}

export async function submitReview(payload: ReviewRequest): Promise<ReviewResponse> {
  const response = await axiosForBackend.post<ReviewResponse>('/api/study/review', payload);
  return response.data;
}

export async function getStudyStats(): Promise<StudyStatsResponse> {
  const response = await axiosForBackend.get<StudyStatsResponse>('/api/study/stats');
  return response.data;
}

export async function getStudySetting(): Promise<StudySettingResponse> {
  const response = await axiosForBackend.get<StudySettingResponse>('/api/study/settings');
  return response.data;
}

export async function updateStudySetting(
  payload: UpdateSettingRequest,
): Promise<StudySettingResponse> {
  const response = await axiosForBackend.put<StudySettingResponse>('/api/study/settings', payload);
  return response.data;
}
