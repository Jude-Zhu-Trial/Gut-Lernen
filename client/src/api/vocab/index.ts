import type {
  CreateListRequest,
  CreateWordRequest,
  VocabListSummary,
  VocabListsResponse,
  VocabWordItem,
  VocabWordsResponse,
} from '@shared/api.interface';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export async function getLists(): Promise<VocabListsResponse> {
  const response = await axiosForBackend.get<VocabListsResponse>('/api/vocab/lists');
  return response.data;
}

export async function createList(payload: CreateListRequest): Promise<VocabListSummary> {
  const response = await axiosForBackend.post<VocabListSummary>('/api/vocab/lists', payload);
  return response.data;
}

export async function deleteList(listId: string): Promise<void> {
  await axiosForBackend.delete(`/api/vocab/lists/${listId}`);
}

export async function getWords(listId: string): Promise<VocabWordsResponse> {
  const response = await axiosForBackend.get<VocabWordsResponse>(
    `/api/vocab/lists/${listId}/words`,
  );
  return response.data;
}

export async function createWord(
  listId: string,
  payload: CreateWordRequest,
): Promise<VocabWordItem> {
  const response = await axiosForBackend.post<VocabWordItem>(
    `/api/vocab/lists/${listId}/words`,
    payload,
  );
  return response.data;
}

export async function deleteWord(wordId: string): Promise<void> {
  await axiosForBackend.delete(`/api/vocab/words/${wordId}`);
}
