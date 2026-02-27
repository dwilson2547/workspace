export interface MediaItem {
  id: number
  file_path: string
  file_name: string
  media_type: 'image' | 'video'
  width: number | null
  height: number | null
  captured_at: string | null
  imported_at: string
  thumbnail_path: string | null
  blip_description: string | null
  is_missing: boolean
  exif_data: Record<string, unknown> | null
}

export interface MediaPage {
  items: MediaItem[]
  next_cursor: number | null
}

export interface Library {
  id: number
  name: string
  created_at: string
  last_accessed_at: string | null
}

export interface Person {
  id: number
  name: string | null
  cover_face_crop_path: string | null
  face_count: number
}

export interface ClusteringRun {
  id: number
  run_number: number
  created_at: string
  parameters: {
    min_cluster_size: number
    min_samples: number
    cluster_selection_epsilon: number
  }
  notes: string | null
  is_active: boolean
  face_count: number
  cluster_count: number
}

export interface ImportResponse {
  accepted: number
  skipped: number
  task_count: number
}
