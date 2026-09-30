import React from 'react';
import {
  Coffee,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  RefreshCw,
  Droplet,
  ShieldCheck,
} from 'lucide-react';
import type { PantryTask, Room } from '../../types/index.ts';

interface PantryDashboardProps {
  tasks: PantryTask[];
  rooms: Room[];
  onCompleteTask: (taskId: string) => void;
  onRefresh: () => void;
}

export const PantryDashboard: React.FC<PantryDashboardProps> = ({
  tasks,
  rooms,
  onCompleteTask,
  onRefresh,
}) => {
  const pendingTasks = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Steward Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-amber-300" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Pantry & Hospitality Operations Floor
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Logged-in steward: <strong className="text-amber-400">Suresh Kumar</strong> • Floor 3 & 4 Pantry Station
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            {pendingTasks.length} Active Tasks
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            {completedTasks.length} Done Today
          </span>
        </div>
      </div>

      {/* Strict Information Rule Alert */}
      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Confidentiality Enforced:</strong> Pantry display strictly contains{' '}
            <strong className="text-amber-400">WHAT, WHERE, and WHEN</strong> (Prompt Rule #20 & #54). Resumes, phone numbers, and salary remarks are strictly suppressed.
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Preparation & Reset Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            Hospitality Tasks Queue ({pendingTasks.length})
          </h2>

          {pendingTasks.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">All rooms prepped & serviced</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Whenever HR assigns a candidate to a room, the workflow engine automatically generates a hospitality task here with zero delay.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-5 bg-slate-900 border-2 border-amber-500/50 hover:border-amber-400 rounded-2xl shadow-xl space-y-3.5 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        {task.taskType === 'ROOM_RESET' ? (
                          <RefreshCw className="w-5 h-5" />
                        ) : (
                          <Droplet className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                            {task.taskType === 'ROOM_RESET' ? 'Sanitization Reset' : 'Hospitality Setup'}
                          </span>
                          <span className="text-[10px] text-slate-500">•</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-white">{task.roomName}</h3>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
                      Pending Action
                    </span>
                  </div>

                  <p className="text-xs text-slate-200">{task.description}</p>

                  {/* Checklist of required items */}
                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Required Hospitality Checklist:
                    </span>
                    <ul className="space-y-1 text-slate-300 pl-4 list-disc text-[11px]">
                      {task.requiredItems?.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Complete Action Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => onCompleteTask(task.id)}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Ready & Mark Completed</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Floor Room Sanitization Status */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            Floor Meeting Rooms
          </h2>

          <div className="space-y-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-xs"
              >
                <div>
                  <h4 className="font-bold text-white">{room.name}</h4>
                  <p className="text-[11px] text-slate-400">{room.floor}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    room.status === 'AVAILABLE'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {room.status}
                </span>
              </div>
            ))}
          </div>

          {/* Completed History Today */}
          {completedTasks.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Completed Hospitality Logs ({completedTasks.length})
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {completedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-[11px] text-slate-400"
                  >
                    <span>{t.roomName}</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
