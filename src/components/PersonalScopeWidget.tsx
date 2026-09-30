import React, { useState } from 'react';
import {
  User as UserIcon,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Briefcase,
  Users,
  DoorOpen,
  Calendar,
  Layers,
  FileText,
  UserCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type { User, PersonalTask, Candidate, Interview, Notification } from '../types/index.ts';

interface PersonalScopeWidgetProps {
  currentUser: User | null;
  tasks: PersonalTask[];
  candidates: Candidate[];
  interviews: Interview[];
  notifications: Notification[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: { title: string; category: any; priority: any; description?: string }) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenDossier: (candidateId: string) => void;
  onAssignRoom?: (candidateId: string, interviewId?: string) => void;
  onStartInterview?: (interviewId: string) => void;
  onOpenSwitchUser?: () => void;
}

export const PersonalScopeWidget: React.FC<PersonalScopeWidgetProps> = ({
  currentUser,
  tasks,
  candidates,
  interviews,
  notifications,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onOpenDossier,
  onAssignRoom,
  onStartInterview,
  onOpenSwitchUser,
}) => {
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<string>('CANDIDATE_REVIEW');
  const [newTaskPriority, setNewTaskPriority] = useState<string>('HIGH');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [activeTab, setActiveTab] = useState<'TASKS' | 'MY_CANDIDATES' | 'MY_INTERVIEWS'>('TASKS');

  const userFirstName = (currentUser?.name || '').toLowerCase().split(' ')[0];

  // User-scoped candidate filtering: Candidates explicitly assigned to meet this user
  const myAssignedCandidates = candidates.filter((c) => {
    if (!currentUser) return false;
    if (c.interviewerId === currentUser.id) return true;
    if (c.personToMeet && userFirstName && c.personToMeet.toLowerCase().includes(userFirstName)) return true;
    if (c.interviewerName && userFirstName && c.interviewerName.toLowerCase().includes(userFirstName)) return true;
    return false;
  });

  // User-scoped interviews: Interviews assigned to this user
  const myInterviews = interviews.filter((i) => {
    if (!currentUser) return false;
    if (i.interviewerId === currentUser.id) return true;
    if (userFirstName && i.interviewerName.toLowerCase().includes(userFirstName)) return true;
    return false;
  });

  const pendingTasks = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask({
      title: newTaskTitle.trim(),
      category: newTaskCategory,
      priority: newTaskPriority,
      description: newTaskDesc.trim(),
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowNewTaskForm(false);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Isolated Personal Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-lg shadow-amber-500/10">
            {currentUser?.name ? currentUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2) : 'WCR'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {currentUser?.name || 'Staff User'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-300">
                {currentUser?.designation || currentUser?.role}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Isolated Personal Session
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ID: <span className="font-mono text-slate-300">{currentUser?.id || currentUser?.userId || 'N/A'}</span> • Department: <span className="text-slate-300">{currentUser?.department || 'Operations'}</span>
            </p>
          </div>
        </div>

        {/* Quick Personal Counts & User Switch */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">My Tasks</span>
            <span className="text-xs font-black text-amber-400">{pendingTasks.length} Pending</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">My Candidates</span>
            <span className="text-xs font-black text-blue-400">{myAssignedCandidates.length} Active</span>
          </div>
          {onOpenSwitchUser && (
            <button
              onClick={onOpenSwitchUser}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
              title="Switch between staff accounts"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Switch User</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('TASKS')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'TASKS'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>My Tasks ({pendingTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MY_CANDIDATES')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'MY_CANDIDATES'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>My Assigned Candidates ({myAssignedCandidates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MY_INTERVIEWS')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'MY_INTERVIEWS'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>My Interview Queue ({myInterviews.length})</span>
        </button>
      </div>

      {/* Tab 1: Personal Tasks */}
      {activeTab === 'TASKS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Private Action Items for {currentUser?.name || 'You'}
            </h3>
            <button
              onClick={() => setShowNewTaskForm(!showNewTaskForm)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showNewTaskForm ? 'Cancel' : 'Add Personal Task'}</span>
            </button>
          </div>

          {/* New Task Form */}
          {showNewTaskForm && (
            <form
              onSubmit={handleCreateTask}
              className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 animate-in fade-in"
            >
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Conduct Round 1 Technical Assessment with Rahul Sharma"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Category</label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  >
                    <option value="INTERVIEW">Interview Assessment</option>
                    <option value="CANDIDATE_REVIEW">Candidate Review / Verification</option>
                    <option value="ROOM_ALLOCATION">Room Allocation</option>
                    <option value="ADMIN_APPROVAL">Admin Approval</option>
                    <option value="FACILITY_CHECK">Facility & Hospitality Check</option>
                    <option value="GENERAL">General Operational</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Notes / Instructions</label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  rows={2}
                  placeholder="Optional details, evaluation criteria, or room requirements..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewTaskForm(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}

          {/* Task Items */}
          {tasks.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-white">All personal tasks completed</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                New tasks are auto-assigned when candidates arrive to meet you or when workflows advance.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isDone = task.status === 'COMPLETED';
                return (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-2xl border transition flex items-start justify-between gap-3 ${
                      isDone
                        ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                          isDone
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-bold'
                            : 'border-slate-700 hover:border-amber-400 text-transparent'
                        }`}
                        title={isDone ? 'Mark as Pending' : 'Mark as Completed'}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-bold ${
                              isDone ? 'line-through text-slate-400' : 'text-white'
                            }`}
                          >
                            {task.title}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                              task.priority === 'CRITICAL'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : task.priority === 'HIGH'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {task.priority}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold bg-slate-900 px-1.5 py-0.5 rounded">
                            {task.category.replace('_', ' ')}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-[11px] text-slate-400">{task.description}</p>
                        )}

                        {task.relatedCandidateName && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[10px] text-amber-400 font-semibold">
                              Candidate: {task.relatedCandidateName}
                            </span>
                            {task.relatedCandidateId && (
                              <button
                                onClick={() => onOpenDossier(task.relatedCandidateId!)}
                                className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                View Dossier <ChevronRight className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="text-slate-400 hover:text-rose-400 p-1 rounded-lg transition cursor-pointer"
                      title="Remove Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Assigned Candidates */}
      {activeTab === 'MY_CANDIDATES' && (
        <div className="space-y-3">
          {myAssignedCandidates.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl">
              <Users className="w-8 h-8 text-blue-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-white">No candidates specifically assigned to you</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                When a candidate arrives with your name as the host, they will appear here instantly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myAssignedCandidates.map((cand) => (
                <div
                  key={cand.id}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-3 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {cand.livePhoto ? (
                        <img
                          src={cand.livePhoto}
                          alt={cand.fullName}
                          className="w-10 h-10 rounded-xl object-cover border border-amber-500/40"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs">
                          {cand.fullName[0]}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-white">{cand.fullName}</h4>
                        <p className="text-[11px] text-slate-400">{cand.position}</p>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[10px] font-bold text-blue-400">
                      {cand.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-0.5 bg-slate-900/60 p-2.5 rounded-xl">
                    <div className="flex justify-between">
                      <span>Current Location:</span>
                      <span className="text-amber-300 font-semibold">{cand.currentLocation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Experience:</span>
                      <span className="text-slate-300">{cand.totalExperience}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Host Assigned:</span>
                      <span className="text-emerald-400 font-semibold">{cand.personToMeet || currentUser?.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onOpenDossier(cand.id)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer text-center"
                    >
                      Open Dossier
                    </button>
                    {onAssignRoom && (cand.status === 'ARRIVED' || cand.status === 'WAITING') && (
                      <button
                        onClick={() => onAssignRoom(cand.id, cand.currentInterviewId)}
                        className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                      >
                        Assign Room
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: My Interviews Queue */}
      {activeTab === 'MY_INTERVIEWS' && (
        <div className="space-y-3">
          {myInterviews.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl">
              <Calendar className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-white">No interviews in your queue</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Evaluation rounds assigned to you will populate here in real-time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myInterviews.map((intv) => (
                <div
                  key={intv.id}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-3 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white">{intv.candidateName}</h4>
                      <p className="text-[11px] text-amber-400 font-semibold">{intv.roundName}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300">
                      {intv.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-0.5 bg-slate-900/60 p-2.5 rounded-xl">
                    <div className="flex justify-between">
                      <span>Room:</span>
                      <span className="text-slate-200 font-semibold">{intv.roomName || 'Not Assigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time:</span>
                      <span className="text-slate-200">{intv.scheduledTime}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onOpenDossier(intv.candidateId)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer text-center"
                    >
                      Dossier
                    </button>
                    {onStartInterview && intv.status !== 'INTERVIEW_STARTED' && intv.status !== 'INTERVIEW_COMPLETED' && (
                      <button
                        onClick={() => onStartInterview(intv.id)}
                        className="py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                      >
                        Start Round
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
