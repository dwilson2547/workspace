import axios from 'axios'
import type { Library, MediaItem, MediaPage, Person, ClusteringRun, ImportResponse } from './types'

export const API_BASE = 'http://127.0.0.1:7899'
const api = axios.create({ baseURL: API_BASE })

export const fetchLibraries = () => api.get<Library[]>('/libraries/').then(r => r.data)
export const createLibrary = (name: string) => api.post<Library>('/libraries/', { name }).then(r => r.data)
export const openLibrary = (libraryName: string): Promise<void> =>
  api.post(`/libraries/${encodeURIComponent(libraryName)}/open`).then(() => undefined)

// Note: backend does not support sort_dir — always sorts ascending by imported_at.
// Components pass sortBy in TanStack Query keys for cache differentiation, but it
// does not affect the API call until the backend is extended.
export const fetchMediaPage = (
  libraryName: string,
  cursor?: number,
  limit = 100,
  personId?: number
) =>
  api.get<MediaPage>(`/libraries/${encodeURIComponent(libraryName)}/media/`, {
    params: {
      cursor,
      limit,
      sort_by: 'imported_at',
      ...(personId !== undefined && { person_id: personId }),
    }
  }).then(r => r.data)

export const fetchMediaItem = (libraryName: string, id: number): Promise<MediaItem> =>
  api.get<MediaItem>(`/libraries/${encodeURIComponent(libraryName)}/media/${id}`)
    .then(r => r.data)

export interface FaceWithPerson {
  id: number
  bounding_box: { x: number; y: number; w: number; h: number }
  crop_path: string | null
  person: { id: number; name: string | null } | null
}

export const fetchMediaFaces = (libraryName: string, mediaId: number): Promise<FaceWithPerson[]> =>
  api.get<FaceWithPerson[]>(
    `/libraries/${encodeURIComponent(libraryName)}/media/${mediaId}/faces`
  ).then(r => r.data)

export const fetchPeople = (libraryName: string): Promise<Person[]> =>
  api.get<Person[]>(`/libraries/${encodeURIComponent(libraryName)}/people/`).then(r => r.data)

// Import media into a library. paths can be individual file paths or folder paths
// (the backend scanner handles recursive directory scanning).
export const importMedia = (libraryName: string, paths: string[]): Promise<ImportResponse> =>
  api.post<ImportResponse>(
    `/libraries/${encodeURIComponent(libraryName)}/import/`,
    { paths }
  ).then(r => r.data)

export const reprocessLibrary = (libraryName: string): Promise<ImportResponse> =>
  api.post<ImportResponse>(
    `/libraries/${encodeURIComponent(libraryName)}/import/reprocess`
  ).then(r => r.data)

// Reassign a face to a different person. is_user_corrected is set to true on the
// backend, so this correction carries forward into future clustering runs.
export const reassignFace = (libraryName: string, faceId: number, personId: number): Promise<void> =>
  api.post(`/libraries/${encodeURIComponent(libraryName)}/people/reassign`, {
    face_id: faceId,
    target_person_id: personId,
  }).then(() => undefined)

// Rename a person.
export const renamePerson = (libraryName: string, personId: number, name: string): Promise<void> =>
  api.put(`/libraries/${encodeURIComponent(libraryName)}/people/${personId}/rename`, { name })
    .then(() => undefined)

// Merge source person into target person. All of source's face assignments move to target.
// source_person_id is removed from the people list after merging.
export const mergePeople = (
  libraryName: string,
  sourcePersonId: number,
  targetPersonId: number
): Promise<void> =>
  api.post(
    `/libraries/${encodeURIComponent(libraryName)}/people/merge`,
    null,                          // no request body
    { params: { source_id: sourcePersonId, target_id: targetPersonId } }
  ).then(() => undefined)

export const getSetting = (key: string): Promise<{ key: string; value: string | null }> =>
  api.get<{ key: string; value: string | null }>(`/settings/${encodeURIComponent(key)}`)
    .then(r => r.data)
    .catch((err: unknown) => {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 404
      ) {
        return { key, value: null }
      }
      throw err
    })

export const setSetting = (key: string, value: string): Promise<void> =>
  api.put(`/settings/${encodeURIComponent(key)}`, { value }).then(() => undefined)

export const fetchClusteringRuns = (libraryName: string): Promise<ClusteringRun[]> =>
  api.get<ClusteringRun[]>(`/libraries/${encodeURIComponent(libraryName)}/clustering/runs`).then(r => r.data)

export interface HdbscanParams {
  min_cluster_size: number
  min_samples: number
  cluster_selection_epsilon: number
}

export const triggerClusteringRun = (
  libraryName: string,
  params: HdbscanParams
): Promise<{ task_id: number }> =>
  api.post<{ task_id: number }>(
    `/libraries/${encodeURIComponent(libraryName)}/clustering/runs`,
    { parameters: params }
  ).then(r => r.data)

export const activateClusteringRun = (
  libraryName: string,
  runId: number
): Promise<ClusteringRun> =>
  api.put<ClusteringRun>(
    `/libraries/${encodeURIComponent(libraryName)}/clustering/runs/${runId}/activate`
  ).then(r => r.data)
