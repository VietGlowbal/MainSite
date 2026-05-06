export interface Mentor {
  id: string;
  name: string;
  avatar?: string;
  university: string;
  universityId: string;
  graduationYear: number;
  subjects: string[];
  bio: string;
  specialisms: ('applications' | 'interviews' | 'scholarships' | 'campus-life' | 'visas')[];
  languages: string[];
  rating?: number;
  sessionCount: number;
  available: boolean;
}

export interface MentoringSession {
  id: string;
  mentorId: string;
  studentId: string;
  universityId: string;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled';
  scheduledAt?: Date;
  notes?: string;
  createdAt: Date;
}
