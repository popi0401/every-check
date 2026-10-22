export interface Profile {
  id: string
  nickname: string | null
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}

export interface Group {
  id: string
  name: string
  invite_code: string | null
  fine_amount: number
  created_at: string
}

export interface PostImage {
  id: string
  post_id: string
  image_url: string
  order: number
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  group_id: string
  date: string
  category: string | null
  subcategory: string | null
  activity_text: string
  edited_at: string | null
  created_at: string
  profiles?: Profile
  reactions?: Reaction[]
  comments?: { id: string }[]
  images?: PostImage[]
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export interface Reaction {
  post_id: string
  user_id: string
  emoji_type: string
  created_at: string
}


export interface ExemptDay {
  id: string
  user_id: string | null
  group_id: string
  date: string
  reason: string | null
  created_at: string
}

export interface MemberWithPost {
  userId: string
  profile: Profile
  post?: Post
}
