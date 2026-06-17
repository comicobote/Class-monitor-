/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import {
  Menu,
  X,
  FileText,
  UserPlus,
  BookOpen,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Hash,
  ChevronRight,
  TrendingUp,
  Users,
  Award,
  Trash2,
  Clipboard,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';
import {
  UGANDA_SUBJECTS,
  DEFAULT_STUDENTS,
  Student,
  AttendanceLog,
  ClassLevel,
  Subject
} from './types';
import { playSuccessBeep, playErrorBeep } from './components/AudioBeep';

export default function App() {
  // --- OFFLINE PERSISTENCE STORES ---
  const [students, setStudents] = useState<Student[]>(() => {
    const raw = localStorage.getItem('ASS_students');
    return raw ? JSON.parse(raw) : DEFAULT_STUDENTS;
  });

  const [logs, setLogs] = useState<AttendanceLog[]>(() => {
    const raw = localStorage.getItem('ASS_attendance_logs');
    return raw ? JSON.parse(raw) : [];
  });

  // Automatically save data state to local storage
  useEffect(() => {
    localStorage.setItem('ASS_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('ASS_attendance_logs', JSON.stringify(logs));
  }, [logs]);

  // --- COMPACT STATE CONTROL ---
  const [selectedClass, setSelectedClass] = useState<ClassLevel>('S.1');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('ENG');
  
  // Real-time student verification ID (Strict numeric filter)
  const [studentIdInput, setStudentIdInput] = useState('');
  
  // High quality feedback banners
  const [feedback, setFeedback] = useState<{ text: string; status: 'success' | 'error'; name?: string } | null>(null);

  // --- SYSTEM DATE & TIME (Uganda Standard East Africa Time: UTC +3) ---
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const updateTime = () => {
      try {
        const timeOption = {
          timeZone: 'Africa/Kampala',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        } as const;

        const dateOption = {
          timeZone: 'Africa/Kampala',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        } as const;

        setCurrentTime(new Date().toLocaleTimeString('en-US', timeOption));
        setCurrentDate(new Date().toLocaleDateString('en-US', dateOption));
      } catch (e) {
        // Safe standard local time fallback if timeZone parameters fail
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString());
        setCurrentDate(now.toLocaleDateString());
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter Ugandan subjects list automatically depending on class level (O-Level vs A-Level)
  const isALevel = selectedClass === 'S.5' || selectedClass === 'S.6';
  const filteredSubjects = UGANDA_SUBJECTS.filter(s => {
    if (isALevel) {
      return s.level === 'A_Level' || s.level === 'Both';
    } else {
      return s.level === 'O_Level' || s.level === 'Both';
    }
  });

  // Ensure active subject stays synchronized when shifting between class tiers
  useEffect(() => {
    const exists = filteredSubjects.some(s => s.code === selectedSubjectCode);
    if (!exists && filteredSubjects.length > 0) {
      setSelectedSubjectCode(filteredSubjects[0].code);
    }
  }, [selectedClass]);

  const getTodayISOString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const kampalaDate = new Date(d.getTime() + (3 * 60 * 60 * 1000) - (offset * 60 * 1000));
    return kampalaDate.toISOString().split('T')[0];
  };

  const todayKey = getTodayISOString();

  // Filter student registries
  const classStudents = students.filter(s => s.classLevel === selectedClass);

  // Fetch current attendance status of student (unmarked students auto-calculate as Absent)
  const getStudentStatus = (studentId: string): 'Present' | 'Absent' => {
    const log = logs.find(l =>
      l.studentId === studentId &&
      l.date === todayKey &&
      l.subjectCode === selectedSubjectCode &&
      l.classLevel === selectedClass
    );
    if (!log || log.status !== 'Present') return 'Absent';
    return 'Present';
  };

  // Stats Counters (Any student not marked Present is automatically counted as Absent)
  const presentCount = classStudents.filter(s => getStudentStatus(s.id) === 'Present').length;
  const absentCount = classStudents.length - presentCount;

  // --- CORE ATTENDANCE MUTATIONS ---
  const markAttendance = (studentId: string, status: 'Present' | 'Absent') => {
    const existingIndex = logs.findIndex(l =>
      l.studentId === studentId &&
      l.date === todayKey &&
      l.subjectCode === selectedSubjectCode &&
      l.classLevel === selectedClass
    );

    const formattedTime = new Date().toTimeString().slice(0, 5);

    if (existingIndex > -1) {
      const copy = [...logs];
      copy[existingIndex] = {
        ...copy[existingIndex],
        status,
        time: formattedTime
      };
      setLogs(copy);
    } else {
      const freshLog: AttendanceLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: todayKey,
        time: formattedTime,
        classLevel: selectedClass,
        subjectCode: selectedSubjectCode,
        studentId,
        status
      };
      setLogs([...logs, freshLog]);
    }
  };

  const resetStudentAttendance = (studentId: string) => {
    setLogs(prev => prev.filter(l =>
      !(l.studentId === studentId &&
        l.date === todayKey &&
        l.subjectCode === selectedSubjectCode &&
        l.classLevel === selectedClass)
    ));
  };

  // --- PROCESS ATTENDANCE SCAN DIAL-IN (Home Page Submit Node) ---
  const processAttendanceSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    setFeedback(null);

    const cleanId = studentIdInput.trim();
    if (!cleanId) {
      playErrorBeep();
      setFeedback({
        text: 'Please enter a Student ID number!',
        status: 'error'
      });
      return;
    }

    // Verify ID numeric search (Class-Specific Match first)
    let matchedStudent = students.find(s => s.id === cleanId && s.classLevel === selectedClass);

    if (!matchedStudent) {
      // Check if the ID exists in ANY other class to provide helpful class-mismatch diagnostics
      const otherClassStudent = students.find(s => s.id === cleanId);
      if (otherClassStudent) {
        playErrorBeep();
        setFeedback({
          text: `${otherClassStudent.name} is in ${otherClassStudent.classLevel}, not ${selectedClass}!`,
          status: 'error',
          name: otherClassStudent.name
        });
        setStudentIdInput('');
        return;
      }

      playErrorBeep();
      setFeedback({
        text: `Student ID "${cleanId}" not registered at Aputi SS!`,
        status: 'error'
      });
      setStudentIdInput('');
      return;
    }

    // Check if student already marked present for this subject today
    const currentStatus = getStudentStatus(matchedStudent.id);
    if (currentStatus === 'Present') {
      const curSubj = UGANDA_SUBJECTS.find(s => s.code === selectedSubjectCode);
      const subjectName = curSubj ? curSubj.name : selectedSubjectCode;
      playErrorBeep();
      setFeedback({
        text: `student already marked present for ${subjectName} today`,
        status: 'error',
        name: matchedStudent.name
      });
      setStudentIdInput('');
      return;
    }

    // Mark student present
    markAttendance(matchedStudent.id, 'Present');
    playSuccessBeep();
    setFeedback({
      text: `${matchedStudent.name} marked PRESENT!`,
      status: 'success',
      name: matchedStudent.name
    });
    setStudentIdInput('');

    // Clear feedback block automatically after 5 seconds to keep dashboard clean
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // Strict digit filtering for student scanner input on Change
  const handleNumericInputOnly = (e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Strip non-digit characters strictly
    const numbersOnly = rawVal.replace(/[^0-9]/g, '');
    setStudentIdInput(numbersOnly);
  };

  // --- POWER USER SIDEBAR MENU DRAWER STATE ---
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'options' | 'enroll' | 'roster' | 'subjects' | 'reports'>('options');

  // --- SIDEBAR TABS STATE ENGINES ---
  // Student Enrollment Form State Node
  const [enrollName, setEnrollName] = useState('');
  const [enrollId, setEnrollId] = useState('');
  const [enrollClass, setEnrollClass] = useState<ClassLevel>('S.1');
  const [enrollGender, setEnrollGender] = useState<'Male' | 'Female'>('Male');
  const [enrollParent, setEnrollParent] = useState('');
  const [enrollFeedback, setEnrollFeedback] = useState<{ text: string; success: boolean } | null>(null);

  // Student roster search filter
  const [rosterSearch, setRosterSearch] = useState('');

  // Strict numeric filter for enroll custom student ID input
  const handleEnrollIdInputOnly = (e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const numbersOnly = rawVal.replace(/[^0-9]/g, '');
    setEnrollId(numbersOnly);
  };

  const handleRegisterStudent = (e: FormEvent) => {
    e.preventDefault();
    setEnrollFeedback(null);

    const cleanName = enrollName.trim();
    if (!cleanName || cleanName.length < 3) {
      setEnrollFeedback({ text: 'Ensure full name is at least 3 letters!', success: false });
      playErrorBeep();
      return;
    }

    // Resolve or assign student numeric ID
    let finalId = enrollId.trim();
    if (finalId) {
      // Check ID conflict is unique within the requested class
      const duplicated = students.some(s => s.id === finalId && s.classLevel === enrollClass);
      if (duplicated) {
        setEnrollFeedback({ text: `ID ${finalId} is already assigned to another student in ${enrollClass}!`, success: false });
        playErrorBeep();
        return;
      }
    } else {
      // Auto assign next ID
      const numIds = students.map(s => parseInt(s.id, 10)).filter(id => !isNaN(id));
      const nextIdNum = numIds.length > 0 ? Math.max(...numIds) + 1 : 1001;
      finalId = nextIdNum.toString();
    }

    // Assemble authentic roll number e.g., ASS/2026/S1/10
    const levelCount = students.filter(s => s.classLevel === enrollClass).length + 1;
    const parsedClassCode = enrollClass.replace('.', '');
    const rollNo = `ASS/2026/${parsedClassCode}/${levelCount < 10 ? '0' + levelCount : levelCount}`;

    const newStudent: Student = {
      id: finalId,
      name: cleanName,
      classLevel: enrollClass,
      gender: enrollGender,
      rollNumber: rollNo,
      parentContact: enrollParent.trim() ? enrollParent.trim() : undefined
    };

    setStudents(prev => [...prev, newStudent]);
    setEnrollFeedback({ text: `Success! Enrolled "${cleanName}" with ID ${finalId}`, success: true });
    playSuccessBeep();

    // Clear inputs
    setEnrollName('');
    setEnrollId('');
    setEnrollParent('');
  };

  // Delete student registry from Local Database
  const deleteStudent = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to permanently delete student "${name}" [ID: ${id}] from Aputi SS rosters?`)) {
      setStudents(prev => prev.filter(s => s.id !== id));
      // Remove attendance logs for this student
      setLogs(prev => prev.filter(l => l.studentId !== id));
      playSuccessBeep();
    }
  };

  // --- REPORT EXPORTS DESK ENGINE ---
  // Create downloadable Excel format (CSV)
  const downloadCSVReport = () => {
    const curSubj = UGANDA_SUBJECTS.find(s => s.code === selectedSubjectCode);
    const subjectName = curSubj ? curSubj.name : selectedSubjectCode;

    let csv = `APUTI SECONDARY SCHOOL - CURRICULAR ATTENDANCE DAILY LEDGER\n`;
    csv += `Exported Date & Time: ${currentDate} at ${currentTime} | School Year: 2026\n`;
    csv += `Academic Level: ${selectedClass} | Subject: ${subjectName}\n\n`;
    csv += `Date,Check-in Time,Student ID,Roll Number,Student Name,Gender,Parents Contact,Attendance Status\n`;

    classStudents.forEach(st => {
      const log = logs.find(l =>
        l.studentId === st.id &&
        l.date === todayKey &&
        l.subjectCode === selectedSubjectCode &&
        l.classLevel === selectedClass
      );

      const status = log && log.status === 'Present' ? 'PRESENT' : 'ABSENT';
      const timeStr = log && log.status === 'Present' ? log.time : 'N/A';
      const dateStr = log && log.status === 'Present' ? log.date : todayKey;
      const contact = st.parentContact && st.parentContact.trim() !== '' ? st.parentContact.trim() : 'N/A';

      csv += `"${dateStr}","${timeStr}","${st.id}","${st.rollNumber}","${st.name.replace(/"/g, '""')}","${st.gender}","${contact}","${status}"\n`;
    });

    const fileBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const fileUrl = URL.createObjectURL(fileBlob);
    const trigger = document.createElement('a');
    trigger.href = fileUrl;
    trigger.setAttribute('download', `Aputi_SS_${selectedClass}_${selectedSubjectCode}_${todayKey}.csv`);
    document.body.appendChild(trigger);
    trigger.click();
    document.body.removeChild(trigger);
  };

  // Format reports copyable to clipboard for Uganda Ministry of Education or SMS/WhatsApp
  const copyReportToClipboard = () => {
    const curSubj = UGANDA_SUBJECTS.find(s => s.code === selectedSubjectCode);
    const subjectName = curSubj ? curSubj.name : selectedSubjectCode;

    let rawText = `*APUTI SECONDARY SCHOOL ATTENDANCE REPORT*\n`;
    rawText += `----------------------------------------------\n`;
    rawText += `📅 Date: ${currentDate}\n`;
    rawText += `⏰ Time: ${currentTime}\n`;
    rawText += `🏫 Class: *${selectedClass}*\n`;
    rawText += `📚 Subject: *${subjectName}*\n`;
    rawText += `👥 Total Enrolled: *${classStudents.length}*\n`;
    rawText += `🟢 Present: *${presentCount}*\n`;
    rawText += `🔴 Absent: *${absentCount}*\n`;
    rawText += `📈 Attendance Rate: *${classStudents.length > 0 ? Math.round((presentCount / classStudents.length) * 100) : 0}%*\n`;
    rawText += `----------------------------------------------\n\n`;
    rawText += `*Student Status Ledger:*\n`;

    classStudents.forEach((st, i) => {
      const log = logs.find(l =>
        l.studentId === st.id &&
        l.date === todayKey &&
        l.subjectCode === selectedSubjectCode &&
        l.classLevel === selectedClass
      );
      const isPresent = log && log.status === 'Present';
      const timeStamp = isPresent ? ` (Checked In at ${log.time})` : '';
      const symbol = isPresent ? `✅ Present${timeStamp}` : '❌ Absent';
      rawText += `${i + 1}. [ID: ${st.id}] ${st.name} - *${symbol}*\n`;
    });

    rawText += `\n_Generated via Aputi SS Attendance Monitor App (Offline: ${currentDate} ${currentTime})_`;

    navigator.clipboard.writeText(rawText)
      .then(() => {
        alert('Ugandan Daily Attendance Report copied to Clipboard successfully! Ready to paste on WhatsApp / SMS.');
      })
      .catch(() => {
        alert('Copy failed. Manual extraction report text:\n\n' + rawText);
      });
  };

  // Factory Database Reset
  const handleFactoryResetDatabase = () => {
    if (window.confirm('CRITICAL ACTION: Reset all customized student registries and clear all attendance history logs?')) {
      setStudents(DEFAULT_STUDENTS);
      setLogs([]);
      setStudentIdInput('');
      setFeedback(null);
      playSuccessBeep();
      alert('Local database re-seeded back to factory settings!');
    }
  };

  // Seed demo logs instantly
  const seedDemoLogData = () => {
    if (window.confirm('Seed random simulated attendance entries for S.1-S.6 today to showcase dashboard features?')) {
      const generated: AttendanceLog[] = [];
      const timestamp = new Date().toTimeString().slice(0, 5);

      students.forEach(student => {
        // Find subject scope matching student class
        const isAL = student.classLevel === 'S.5' || student.classLevel === 'S.6';
        const targetSubjects = UGANDA_SUBJECTS.filter(s => isAL ? (s.level === 'A_Level' || s.level === 'Both') : (s.level === 'O_Level' || s.level === 'Both'));

        targetSubjects.forEach(s => {
          // 80% mark rates
          const chance = Math.random();
          let state: 'Present' | 'Absent' | 'Unmarked' = 'Present';
          if (chance > 0.8) state = 'Absent';
          else if (chance > 0.95) state = 'Unmarked';

          if (state !== 'Unmarked') {
            generated.push({
              id: `seed_${student.id}_${s.code}_${Date.now()}`,
              date: todayKey,
              time: timestamp,
              classLevel: student.classLevel,
              subjectCode: s.code,
              studentId: student.id,
              status: state as 'Present' | 'Absent'
            });
          }
        });
      });

      setLogs(generated);
      playSuccessBeep();
      alert(`Success! Simulated ${generated.length} UNEB-aligned class registration entries for today.`);
    }
  };

  return (
    <div id="app-viewport" className="h-[100dvh] w-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden bg-slate-950 font-sans shadow-2xl relative text-slate-100 border-x border-slate-900">
      
      {/* --- TOP FIXED NAVBAR HEADER (PERFECTLY PORTRAIT, NO SCROLLING DOWN) --- */}
      <header className="shrink-0 h-16 border-b border-amber-500/30 bg-slate-900/95 flex items-center justify-between px-4 relative z-10">
        <div className="flex items-center gap-3">
          <button
            id="btn-sidebar-open"
            onClick={() => { setSidebarOpen(true); setSidebarTab('options'); }}
            className="p-1.5 rounded-lg text-amber-400 bg-slate-950 border border-slate-800 hover:bg-slate-800 active:scale-95 transition-all"
            title="Open Power Functions Menu"
          >
            <Menu className="w-5 h-5 stroke-2" />
          </button>
          
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-300" />
              <h1 className="text-sm font-extrabold text-white uppercase tracking-wider font-display shrink-0">
                Aputi SS
              </h1>
            </div>
            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-tight leading-none mt-0.5">
              Attendance Monitor
            </p>
          </div>
        </div>

        {/* Live Eastern Africa Time Display */}
        <div className="text-right flex flex-col items-end">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono text-xs font-black tracking-widest uppercase">{currentTime || '08:00:00 AM'}</span>
          </div>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{currentDate || 'Loading Calendar...'}</span>
        </div>
      </header>

      {/* --- HOMEPAGE VERIFICATION MATRIX (PORTRAIT PORTABLE, ZERO SCROLL DESIGN) --- */}
      <main className="flex-1 overflow-hidden flex flex-col justify-between py-3.5 px-4 sm:p-5 bg-gradient-to-b from-slate-950 to-slate-900 gap-2.5">
        
        {/* Simple Selectors Row - Highly visible */}
        <div className="space-y-3 shrink-0">
          
          {/* Class Select Dropdown Block */}
          <div>
            <label className="block text-[11px] font-black text-amber-400 uppercase tracking-widest mb-1.5">
              📚 Academic Class Level
            </label>
            <div className="grid grid-cols-6 gap-1">
              {(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'] as ClassLevel[]).map(lvl => (
                <button
                  id={`class-tab-${lvl.replace('.', '')}`}
                  key={lvl}
                  onClick={() => { setSelectedClass(lvl); setFeedback(null); }}
                  className={`py-2 text-center rounded-lg font-display text-sm font-extrabold border transition-all active:scale-95 ${
                    selectedClass === lvl
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 font-black'
                      : 'bg-slate-950/80 text-slate-300 border-slate-900 hover:bg-slate-900'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Grouped Ugandan Subjects Dropdown Selector */}
          <div>
            <label className="block text-[11px] font-black text-amber-400 uppercase tracking-widest mb-1.5">
              📖 National Curriculum Subject
            </label>
            <select
              id="home-subject-selector"
              value={selectedSubjectCode}
              onChange={(e) => { setSelectedSubjectCode(e.target.value); setFeedback(null); }}
              className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl py-2 px-3 text-sm text-white font-extrabold focus:outline-none focus:border-amber-500/50 transition-colors cursor-pointer"
            >
              {filteredSubjects.map(sub => (
                <option key={sub.code} value={sub.code} className="bg-slate-950 text-slate-100 text-xs font-medium font-sans">
                  [{sub.code}] {sub.name} • {sub.category}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Central Scan Terminal Widget - Reduced Button size & Stunning High-Contrast Dark Glow Style */}
        <div className="bg-black/90 rounded-2xl p-5 border-2 border-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.8)] relative flex flex-col justify-center my-2 select-none">
          
          <label className="block text-center text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2.5 font-display">
            ⚡ Swipe Card or Enter Student ID (Numbers Only)
          </label>

          <form onSubmit={processAttendanceSubmit} className="space-y-3.5">
            
            {/* Direct code input block */}
            <div className="relative flex items-center justify-center">
              <Hash className="absolute left-4 w-5 h-5 text-amber-500" />
              <input
                id="student-scanner-input"
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="TYPE ID (e.g. 1001)"
                value={studentIdInput}
                onChange={handleNumericInputOnly}
                className="w-full bg-slate-950 hover:bg-black border-2 border-amber-500/30 rounded-xl py-3 pl-11 pr-4 text-center text-xl font-black tracking-widest text-yellow-400 focus:outline-none focus:border-amber-500/80 placeholder-slate-800 transition-all font-mono shadow-inner"
                maxLength={6}
                required
              />
            </div>

            {/* REDUCED SCAN BUTTON - Clean, Elegant, Professional size & bold uppercase styling */}
            <button
              id="btn-verify-attendance"
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 active:scale-95 text-slate-950 text-xs font-black tracking-widest uppercase py-3 rounded-lg border-t border-emerald-300 shadow-[0_4px_12px_rgba(16,185,129,0.15)] transition-all font-display hover:brightness-110 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 stroke-2" />
              VERIFY & MARK PRESENT
            </button>

          </form>

          {/* Quick results Toast Feedback */}
          <div className="mt-3.5 min-h-[44px] flex items-center justify-center">
            {feedback ? (
              <div
                id="feedback-toast"
                className={`w-full py-2.5 px-3.5 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-2 transition-all ${
                  feedback.status === 'success'
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.25)] pulse-success'
                    : 'bg-red-950/90 text-red-300 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.25)] pulse-error'
                }`}
              >
                {feedback.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 font-medium text-center uppercase tracking-wider leading-relaxed">
                Offline Local Register Safeguard Enabled • ID digits only
              </p>
            )}
          </div>

        </div>

        {/* Live Attendance Counter Widget Box - Stunning glowing green/red cards */}
        <div className="grid grid-cols-2 gap-3.5 shrink-0 select-none">
          
          {/* Present Side */}
          <div className="bg-black/80 border border-emerald-500/30 rounded-xl p-3.5 text-center shadow-[0_4px_20px_rgba(16,185,129,0.06)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500" />
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">
              🟢 PRESENT STUDENTS
            </span>
            <span id="label-present-count" className="font-mono text-3xl font-black text-emerald-400 mt-1 block tracking-tight">
              {presentCount}
              <span className="text-xs text-slate-500 font-bold ml-1">of {classStudents.length}</span>
            </span>
          </div>

          {/* Absent Side */}
          <div className="bg-black/80 border border-red-500/30 rounded-xl p-3.5 text-center shadow-[0_4px_20px_rgba(239,68,68,0.06)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-red-500" />
            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest block">
              🔴 ABSENT STUDENTS
            </span>
            <span id="label-absent-count" className="font-mono text-3xl font-black text-red-500 mt-1 block tracking-tight">
              {absentCount}
              <span className="text-xs text-slate-500 font-bold ml-1">remaining</span>
            </span>
          </div>

        </div>
      </main>

      {/* --- POWER WORKSPACE DRAWER SIDEBAR (SLIDES FROM LEFT TO RIGHT) --- */}
      {sidebarOpen && (
        <div className="absolute inset-0 z-50 flex overflow-hidden">
          
          {/* Visual Dark Overlay */}
          <div
            id="sidebar-overlay"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => { setSidebarOpen(false); setEnrollFeedback(null); }}
          />

          {/* Drawer content (Left static cabinet panel) */}
          <div
            id="sidebar-panel"
            className="absolute left-0 top-0 bottom-0 w-[290px] bg-slate-900 border-r-2 border-amber-500/30 shadow-2xl flex flex-col justify-between overflow-hidden relative z-10 transition-transform duration-350"
          >
            
            {/* Drawer Active Header */}
            <div className="shrink-0 p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-xs font-display tracking-tight text-white uppercase">Aputi SS Cabinet</h3>
                  <p className="text-[9px] text-emerald-400 font-black tracking-wider uppercase leading-none mt-0.5">Admin Desk</p>
                </div>
              </div>
              
              <button
                id="btn-sidebar-close"
                onClick={() => { setSidebarOpen(false); setEnrollFeedback(null); }}
                className="p-1 rounded-lg text-slate-450 hover:bg-slate-800 active:scale-95 transition-colors border border-slate-800"
                title="Exit Drawer"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Main Interactive Workspaces panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* VIEW 1: HOME NAVIGATION SELECTION MENU */}
              {sidebarTab === 'options' && (
                <div className="space-y-3.5">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-1">
                    Select Power Feature
                  </span>

                  {/* Feature: Roster List */}
                  <button
                    id="side-opt-roster"
                    onClick={() => setSidebarTab('roster')}
                    className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-left flex items-center justify-between text-xs transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-2.5 text-slate-250">
                      <Users className="w-4.5 h-4.5 text-blue-400 group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="font-extrabold text-slate-250">Active Student Register</p>
                        <p className="text-[9px] text-slate-500">Edit list, add list, check-in students</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* Feature: Enroll Student */}
                  <button
                    id="side-opt-enroll"
                    onClick={() => setSidebarTab('enroll')}
                    className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-left flex items-center justify-between text-xs transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-2.5 text-slate-250">
                      <UserPlus className="w-4.5 h-4.5 text-emerald-450 group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="font-extrabold text-slate-250">Enroll New Student</p>
                        <p className="text-[9px] text-slate-500">Set custom IDs & names</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* Feature: Uganda Curriculum Catalogue */}
                  <button
                    id="side-opt-subjects"
                    onClick={() => setSidebarTab('subjects')}
                    className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-left flex items-center justify-between text-xs transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-2.5 text-slate-250">
                      <BookOpen className="w-4.5 h-4.5 text-amber-500 group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="font-extrabold text-slate-250">National Curriculum</p>
                        <p className="text-[9px] text-slate-500">Subjects studied in Uganda</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* Feature: Reports & Exports Desk */}
                  <button
                    id="side-opt-reports"
                    onClick={() => setSidebarTab('reports')}
                    className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-left flex items-center justify-between text-xs transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-2.5 text-slate-250">
                      <FileText className="w-4.5 h-4.5 text-violet-400 group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="font-extrabold text-slate-250">Export Report Desk</p>
                        <p className="text-[9px] text-slate-500">Download Excel, copy WhatsApp</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  <div className="h-px bg-slate-800 my-4" />
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-1">
                    Seeding & Setup
                  </span>

                  {/* Demo records seeder */}
                  <button
                    id="side-opt-seed"
                    onClick={seedDemoLogData}
                    className="w-full p-2 text-left text-xs text-amber-300 bg-amber-500/10 border border-amber-950 rounded-lg hover:bg-amber-500/15 flex items-center gap-2.5 transition-colors"
                  >
                    <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="font-bold">Auto-Seed Attendance Statistics</p>
                      <p className="text-[8px] text-amber-500/80 leading-none">Generates random records for S.1-S.6 today</p>
                    </div>
                  </button>

                  {/* Hard system clear */}
                  <button
                    id="side-opt-reset"
                    onClick={handleFactoryResetDatabase}
                    className="w-full p-2 text-left text-xs text-red-300 bg-red-950/30 border border-red-950/50 rounded-lg hover:bg-red-950/45 flex items-center gap-2.5 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-red-400 shrink-0" />
                    <div>
                      <p className="font-bold">Factory Database Reset</p>
                      <p className="text-[8px] text-red-400/80 leading-none">Restores default student roster list</p>
                    </div>
                  </button>

                  <div className="bg-slate-950 p-2 text-[9px] text-slate-500 tracking-normal rounded border border-slate-850 mt-5 leading-relaxed text-center">
                    <p className="font-black text-slate-400 uppercase tracking-widest">ASS Attendance Monitor v1.2</p>
                    <p className="mt-1">Designed for offline rugged tablet operations at Aputi SS, Uganda. Zero internet connection required.</p>
                  </div>
                </div>
              )}

              {/* VIEW 2: FULL REGISTER / ROLL-CALL ROSTER LIST (POWER UTILITY) */}
              {sidebarTab === 'roster' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSidebarTab('options')}
                      className="text-xs font-bold text-amber-400 hover:underline"
                    >
                      ← Back to Menu
                    </button>
                    <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 bg-slate-950 py-0.5 px-2 rounded">
                      Roster: {selectedClass}
                    </span>
                  </div>

                  {/* Student Search inside roster list */}
                  <div className="relative">
                    <input
                      id="roster-student-search"
                      type="text"
                      placeholder="Search enrolled student..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-600 text-xs py-2 px-2.5 rounded focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Scrollable list card container */}
                  <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-1 text-slate-100">
                    {classStudents
                      .filter(s => s.name.toLowerCase().includes(rosterSearch.toLowerCase()) || s.id.includes(rosterSearch))
                      .map(student => {
                        const status = getStudentStatus(student.id);
                        return (
                          <div key={student.id} className="bg-slate-950 p-2 rounded border border-slate-850 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-1 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-[9px] text-amber-500 bg-amber-500/10 px-0.5 rounded border border-amber-950">ID {student.id}</span>
                                <h4 className="font-bold text-slate-200 truncate">{student.name}</h4>
                              </div>
                              <p className="text-[9px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                <span>{student.rollNumber}</span>
                                <span className="font-semibold text-slate-400 text-[8px] uppercase">({student.gender === 'Female' ? 'Girl' : 'Boy'})</span>
                              </p>
                            </div>

                            {/* Direct tap status markers right on roster list */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                id={`roster-present-${student.id}`}
                                onClick={() => markAttendance(student.id, status === 'Present' ? 'Absent' : 'Present')}
                                className={`px-2 py-1 text-[9px] font-black rounded border transition-colors ${
                                  status === 'Present'
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                    : status === 'Absent'
                                    ? 'bg-red-500 text-slate-950 border-red-400'
                                    : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}
                              >
                                {status === 'Present' ? 'PRESENT' : status === 'Absent' ? 'ABSENT' : 'MARK'}
                              </button>

                              <button
                                id={`roster-delete-${student.id}`}
                                onClick={() => deleteStudent(student.id, student.name)}
                                className="p-1 text-slate-600 hover:text-red-400 hover:border-slate-800 border border-transparent rounded transition-colors"
                                title="Delete student roster card"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {classStudents.filter(s => s.name.toLowerCase().includes(rosterSearch.toLowerCase()) || s.id.includes(rosterSearch)).length === 0 && (
                      <p className="text-center text-[10px] text-slate-600 py-6">No enrolled students matched filters</p>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 3: ENROLL NEW STUDENT WITH ID PREFERENCES */}
              {sidebarTab === 'enroll' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => { setSidebarTab('options'); setEnrollFeedback(null); }}
                      className="text-xs font-bold text-amber-400 hover:underline"
                    >
                      ← Back to Menu
                    </button>
                    <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400">
                      Roster Enrollment
                    </span>
                  </div>

                  <form onSubmit={handleRegisterStudent} className="space-y-3">
                    
                    {/* Full Name input */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Full Student Name (Surname First)
                      </label>
                      <input
                        id="reg-student-name"
                        type="text"
                        placeholder="e.g. Obote Bonny"
                        value={enrollName}
                        onChange={(e) => setEnrollName(e.target.value)}
                        className="w-full bg-slate-955 border border-slate-850 rounded py-2 px-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>

                    {/* Student ID input OPTION (Teacher custom selection) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Student ID Code (Option)
                        </label>
                        <span className="text-[8px] text-amber-500 font-bold uppercase">NUMBERS ONLY</span>
                      </div>
                      <input
                        id="reg-student-id"
                        type="text"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="Assign custom ID (empty to auto-assign)"
                        value={enrollId}
                        onChange={handleEnrollIdInputOnly}
                        className="w-full bg-slate-950 border border-slate-850 rounded py-2 px-2.5 text-xs text-white font-mono placeholder-slate-700 focus:outline-none focus:border-emerald-500"
                        maxLength={5}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Class level selection */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Class Level
                        </label>
                        <select
                          id="reg-student-class"
                          value={enrollClass}
                          onChange={(e) => setEnrollClass(e.target.value as ClassLevel)}
                          className="w-full bg-slate-950 border border-slate-850 rounded py-1.5 px-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          {(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'] as ClassLevel[]).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Gender selection */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Gender Status
                        </label>
                        <div className="grid grid-cols-2 gap-1 h-[28px]">
                          {(['Male', 'Female'] as const).map(g => (
                            <button
                              type="button"
                              key={g}
                              onClick={() => setEnrollGender(g)}
                              className={`py-1 text-[10px] font-extrabold rounded border transition-colors ${
                                enrollGender === g
                                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                                  : 'bg-slate-955 border-slate-850 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {g === 'Male' ? 'BOY' : 'GIRL'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Parents Contact */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Parents Contact / SMS Mobile
                      </label>
                      <input
                        id="reg-student-parent"
                        type="tel"
                        placeholder="e.g. +256772120155"
                        value={enrollParent}
                        onChange={(e) => setEnrollParent(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-855 rounded py-2 px-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      id="btn-save-enrollment"
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider py-2.5 rounded transition-all cursor-pointer mt-2"
                    >
                      SAVE STUDENT REGISTER
                    </button>

                    {enrollFeedback && (
                      <div
                        id="enroll-feedback-banner"
                        className={`p-2 rounded text-[10px] text-center font-bold border ${
                          enrollFeedback.success
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                            : 'bg-red-950/80 text-red-300 border-red-800'
                        }`}
                      >
                        {enrollFeedback.text}
                      </div>
                    )}

                  </form>
                </div>
              )}

              {/* VIEW 4: OFFICIAL UGANDA SUBJECTS CATALOG */}
              {sidebarTab === 'subjects' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSidebarTab('options')}
                      className="text-xs font-bold text-amber-400 hover:underline"
                    >
                      ← Back to Menu
                    </button>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      National Subjects
                    </span>
                  </div>

                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    Aputi Secondary School curriculum conforms to the National Curriculum Development Centre (NCDC) standards.
                  </p>

                  <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
                    <div className="border border-slate-800 rounded divide-y divide-slate-850">
                      {UGANDA_SUBJECTS.map(s => (
                        <div key={s.code} className="p-2 bg-slate-950 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1 rounded border border-amber-950">
                              {s.code}
                            </span>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                              {s.level === 'Both' ? 'O & A Level' : s.level === 'O_Level' ? 'O-Level Only' : 'A-Level Principal'}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-200 mt-1">{s.name}</h4>
                          <span className="text-[8px] text-emerald-400 font-medium font-sans mt-0.5 block">{s.category} Category</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 5: DOWNLOADABLE REPORTS AND TEXT WORKFLOWS */}
              {sidebarTab === 'reports' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSidebarTab('options')}
                      className="text-xs font-bold text-amber-400 hover:underline"
                    >
                      ← Back to Menu
                    </button>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Exports Desk
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-3.5">
                    <h4 className="text-xs font-black text-amber-500 uppercase tracking-wider">
                      Academic Class Report ({selectedClass})
                    </h4>
                    
                    {/* Live Ledger Preview Widget prior to Copy/Download */}
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">
                          👁️ Daily Ledger Preview
                        </span>
                        <span className="font-mono text-[9px] font-bold text-emerald-400">
                          {presentCount}/{classStudents.length} PRESENT
                        </span>
                      </div>
                      
                      <div className="max-h-[140px] overflow-y-auto divide-y divide-slate-950 bg-slate-950/80 p-2 rounded border border-slate-850 space-y-1">
                        {classStudents.map(student => {
                          const log = logs.find(l =>
                            l.studentId === student.id &&
                            l.date === todayKey &&
                            l.subjectCode === selectedSubjectCode &&
                            l.classLevel === selectedClass
                          );
                          const isPresent = log && log.status === 'Present';
                          return (
                            <div key={student.id} className="pt-1 first:pt-0 flex justify-between items-center text-[10px]">
                              <span className="truncate text-slate-300 font-bold max-w-[130px]">
                                {student.name}
                              </span>
                              <span className={`font-mono text-[8px] font-black ${isPresent ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {isPresent ? `✅ PRESENT (${log.time})` : '❌ ABSENT'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* Excel Download button */}
                      <button
                        id="btn-download-csv"
                        onClick={downloadCSVReport}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 text-xs font-black rounded-lg flex items-center justify-center gap-2 uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        Download Register (CSV)
                      </button>

                      {/* Clipboard copy report trigger */}
                      <button
                        id="btn-copy-report"
                        onClick={copyReportToClipboard}
                        className="w-full py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 text-amber-400 text-xs font-black rounded-lg flex items-center justify-center gap-2 uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <Clipboard className="w-4 h-4 shrink-0" />
                        Copy text report
                      </button>
                    </div>

                    <div className="bg-slate-900/60 p-2 text-[8px] text-slate-500 leading-normal rounded text-center">
                      CSV excel outputs include full date, check-in timestamps, enrollment numbers, genders, and contacts with absolutely zero blank cell columns.
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Back to Home close drawer link */}
            <div className="shrink-0 p-3 bg-slate-950 border-t border-slate-800">
              <button
                id="btn-drawer-home-return"
                onClick={() => { setSidebarOpen(false); setEnrollFeedback(null); }}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-black rounded-lg uppercase tracking-widest text-center transition-colors border border-slate-850"
              >
                RETURN TO ATTENDANCE HOME
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- OFFLINE POWER BY STAMP FOOTER (ESTABLISHES TRUST & CLEAN DESIGN) --- */}
      <footer className="shrink-0 h-8 border-t border-slate-900 bg-slate-950 flex items-center justify-between px-4 text-[9px] text-slate-500 uppercase select-none">
        <span>Aputi SS UNEB Center standard</span>
        <span className="font-mono text-emerald-400 bg-emerald-950/10 py-[1px] px-1 rounded font-bold">
          ● OFFLINE LOCAL DBSECURED
        </span>
      </footer>

    </div>
  );
}
