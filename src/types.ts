/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ClassLevel = 'S.1' | 'S.2' | 'S.3' | 'S.4' | 'S.5' | 'S.6';

export interface Student {
  id: string; // ID number card (e.g. "101", "102")
  name: string;
  classLevel: ClassLevel;
  gender: 'Male' | 'Female';
  rollNumber: string;
  parentContact?: string;
}

export type SubjectCategory = 'Sciences' | 'Humanities' | 'Languages' | 'Vocational';

export interface Subject {
  code: string;
  name: string;
  category: SubjectCategory;
  level: 'O_Level' | 'A_Level' | 'Both';
}

export interface AttendanceLog {
  id: string; // e.g. "log_12345"
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  classLevel: ClassLevel;
  subjectCode: string;
  studentId: string;
  status: 'Present' | 'Absent';
}

// Uganda National Subjects Dictionary
export const UGANDA_SUBJECTS: Subject[] = [
  // O-Level & Core
  { code: 'ENG', name: 'English Language', category: 'Languages', level: 'O_Level' },
  { code: 'MAT-O', name: 'Mathematics', category: 'Sciences', level: 'O_Level' },
  { code: 'PHY', name: 'Physics', category: 'Sciences', level: 'O_Level' },
  { code: 'CHE', name: 'Chemistry', category: 'Sciences', level: 'O_Level' },
  { code: 'BIO', name: 'Biology', category: 'Sciences', level: 'O_Level' },
  { code: 'GEO', name: 'Geography', category: 'Humanities', level: 'O_Level' },
  { code: 'HIS', name: 'History & Political Education', category: 'Humanities', level: 'O_Level' },
  { code: 'KIS', name: 'Kiswahili', category: 'Languages', level: 'Both' },
  { code: 'CRE', name: 'Christian Religious Education (CRE)', category: 'Humanities', level: 'O_Level' },
  { code: 'IRE', name: 'Islamic Religious Education (IRE)', category: 'Humanities', level: 'O_Level' },
  { code: 'AGR', name: 'Agriculture', category: 'Sciences', level: 'Both' },
  { code: 'ENT', name: 'Entrepreneurship Education', category: 'Vocational', level: 'Both' },
  { code: 'ICT', name: 'Information & Comm. Tech (ICT)', category: 'Vocational', level: 'Both' },
  { code: 'ART', name: 'Fine Art / Art & Design', category: 'Vocational', level: 'Both' },
  { code: 'LIT', name: 'Literature in English', category: 'Languages', level: 'Both' },
  { code: 'MUS', name: 'Music', category: 'Vocational', level: 'O_Level' },
  { code: 'PE', name: 'Physical Education', category: 'Vocational', level: 'O_Level' },

  // A-Level Principal
  { code: 'GP', name: 'General Paper (GP)', category: 'Humanities', level: 'A_Level' },
  { code: 'SUB-M', name: 'Subsidiary Mathematics', category: 'Sciences', level: 'A_Level' },
  { code: 'S-ICT', name: 'Subsidiary ICT', category: 'Vocational', level: 'A_Level' },
  { code: 'MAT-A', name: 'Mathematics (Principal)', category: 'Sciences', level: 'A_Level' },
  { code: 'PHY-P', name: 'Physics (Principal)', category: 'Sciences', level: 'A_Level' },
  { code: 'CHE-P', name: 'Chemistry (Principal)', category: 'Sciences', level: 'A_Level' },
  { code: 'BIO-P', name: 'Biology (Principal)', category: 'Sciences', level: 'A_Level' },
  { code: 'HIS-P', name: 'History (Principal)', category: 'Humanities', level: 'A_Level' },
  { code: 'ECO-P', name: 'Economics', category: 'Humanities', level: 'A_Level' },
  { code: 'GEO-P', name: 'Geography (Principal)', category: 'Humanities', level: 'A_Level' },
  { code: 'DIV', name: 'Divinity / REL (Principal)', category: 'Humanities', level: 'A_Level' },
  { code: 'LUG', name: 'Luganda', category: 'Languages', level: 'A_Level' }
];

// Seed Students with authentic Ugandan names reflecting O & A Levels
export const DEFAULT_STUDENTS: Student[] = [
  { id: '01', name: 'Moses Okello', classLevel: 'S.1', gender: 'Male', rollNumber: 'ASS/2026/S1/01', parentContact: '+256772100201' },
  { id: '02', name: 'Sarah Auma', classLevel: 'S.1', gender: 'Female', rollNumber: 'ASS/2026/S1/02', parentContact: '+256782300405' },
  { id: '03', name: 'Patrick Opio', classLevel: 'S.1', gender: 'Male', rollNumber: 'ASS/2026/S1/03', parentContact: '+256701555660' },
  { id: '04', name: 'Harriet Atim', classLevel: 'S.1', gender: 'Female', rollNumber: 'ASS/2026/S1/04', parentContact: '+256752987123' },
  { id: '05', name: 'Denis Angole', classLevel: 'S.1', gender: 'Male', rollNumber: 'ASS/2026/S1/05' },
  
  { id: '01', name: 'Hellen Aceng', classLevel: 'S.2', gender: 'Female', rollNumber: 'ASS/2026/S2/01', parentContact: '+256773445566' },
  { id: '02', name: 'Godfrey Ocen', classLevel: 'S.2', gender: 'Male', rollNumber: 'ASS/2026/S2/02' },
  { id: '03', name: 'Scovia Ejang', classLevel: 'S.2', gender: 'Female', rollNumber: 'ASS/2026/S2/03', parentContact: '+256789112233' },
  { id: '04', name: 'Thomas Okwir', classLevel: 'S.2', gender: 'Male', rollNumber: 'ASS/2026/S2/04' },
  
  { id: '01', name: 'Francis Ogwang', classLevel: 'S.3', gender: 'Male', rollNumber: 'ASS/2026/S3/01', parentContact: '+256771002003' },
  { id: '02', name: 'Mercy Akello', classLevel: 'S.3', gender: 'Female', rollNumber: 'ASS/2026/S3/02', parentContact: '+256704123456' },
  { id: '03', name: 'Tonny Odongo', classLevel: 'S.3', gender: 'Male', rollNumber: 'ASS/2026/S3/03' },
  { id: '04', name: 'Brenda Apio', classLevel: 'S.3', gender: 'Female', rollNumber: 'ASS/2026/S3/04' },

  { id: '01', name: 'John Obote', classLevel: 'S.4', gender: 'Male', rollNumber: 'ASS/2026/S4/01', parentContact: '+256781223344' },
  { id: '02', name: 'Peace Amolo', classLevel: 'S.4', gender: 'Female', rollNumber: 'ASS/2026/S4/02', parentContact: '+256775990011' },
  { id: '03', name: 'Kenneth Omunu', classLevel: 'S.4', gender: 'Male', rollNumber: 'ASS/2026/S4/03' },
  { id: '04', name: 'Ketty Alum', classLevel: 'S.4', gender: 'Female', rollNumber: 'ASS/2026/S4/04' },

  { id: '01', name: 'Solomon Elimu', classLevel: 'S.5', gender: 'Male', rollNumber: 'ASS/2026/S5/01', parentContact: '+256755443322' },
  { id: '02', name: 'Lillian Apophia', classLevel: 'S.5', gender: 'Female', rollNumber: 'ASS/2026/S5/02', parentContact: '+256774902010' },
  { id: '03', name: 'Emmanuel Egwel', classLevel: 'S.5', gender: 'Male', rollNumber: 'ASS/2026/S5/03' },

  { id: '01', name: 'Sharon Adongo', classLevel: 'S.6', gender: 'Female', rollNumber: 'ASS/2026/S6/01', parentContact: '+256782998877' },
  { id: '02', name: 'Derrick Opio', classLevel: 'S.6', gender: 'Male', rollNumber: 'ASS/2026/S6/02', parentContact: '+256711990088' }
];
