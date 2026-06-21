import { Track, PlayHistoryEntry } from '../types';
import { calculateListeningInsights } from '../utils/stats';
import { Clock, Disc, Music, User, Headphones, Award, Star, Activity } from 'lucide-react';

interface StatsViewProps {
  tracks: Track[];
  history: PlayHistoryEntry[];
  onPlayTrack: (track: Track) => void;
  accentColor: string;
}

export default function StatsView({ tracks, history, onPlayTrack, accentColor }: StatsViewProps) {
  const insights = calculateListeningInsights(tracks, history);

  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 fill-emerald-500',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20 fill-sky-500',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20 fill-rose-500',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20 fill-violet-500',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20 fill-amber-500',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 fill-indigo-500',
    teal: 'text-teal-400 bg-teal-500/10 border-teal-500/20 fill-teal-500',
  };

  const accentColorClass = colors[accentColor] || 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

  // Format total listening time
  const formatListenTime = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hrs}h ${m}m`;
  };

  // Find max value in timeline for scaling
  const maxMinsInTimeline = Math.max(...insights.recentActivityTimeline.map(t => t.minutes), 1);
  // Find max value in hourly activity for scaling
  const maxHourlyPlays = Math.max(...insights.hourlyActivity, 1);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]" id="empty-stats-view">
        <div className={`p-4 rounded-2xl ${accentColorClass} mb-4`}>
          <Activity size={32} />
        </div>
        <h3 className="text-lg font-semibold text-white">No Listening History Yet</h3>
        <p className="text-xs text-neutral-400 max-w-sm mt-2">
          Your statistics, most played songs, listening times, and heatmaps will populate here as you listen.
        </p>
        <span className="text-[11px] text-neutral-500 mt-4 bg-white/5 px-3 py-1 rounded-full">
          Note: Play counts update only after 30 seconds of playback
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto text-neutral-200" id="stats-view-container">
      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-overview-cards-grid">
        {/* Card 1: Total Listening Time */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-5 rounded-2xl flex items-center space-x-4">
          <div className={`p-3 rounded-xl ${accentColorClass}`}>
            <Clock size={22} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-neutral-400">Listening Time</span>
            <span className="block text-2xl font-bold font-sans text-white mt-0.5">
              {formatListenTime(insights.totalMinutes)}
            </span>
          </div>
        </div>

        {/* Card 2: Total Play Triggers */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-5 rounded-2xl flex items-center space-x-4">
          <div className={`p-3 rounded-xl ${accentColorClass}`}>
            <Headphones size={22} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-neutral-400">Total Plays</span>
            <span className="block text-2xl font-bold text-white mt-0.5">
              {insights.totalPlays} times
            </span>
          </div>
        </div>

        {/* Card 3: Library percentage played */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-5 rounded-2xl flex items-center space-x-4">
          <div className={`p-3 rounded-xl ${accentColorClass}`}>
            <Disc size={22} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-neutral-400">Library Explored</span>
            <span className="block text-2xl font-bold text-white mt-0.5">
              {insights.uniquenessScore}%
            </span>
          </div>
        </div>

        {/* Card 4: Most Active Hour */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-5 rounded-2xl flex items-center space-x-4">
          <div className={`p-3 rounded-xl ${accentColorClass}`}>
            <Award size={22} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-neutral-400">Peak hour</span>
            <span className="block text-2xl font-bold text-white mt-0.5">
              {insights.hourlyActivity.indexOf(maxHourlyPlays)}:00
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="charts-main-row">
        {/* Past 7 Days Play Activity */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-6 rounded-2xl space-y-4">
          <div>
            <h4 className="font-semibold text-white">Daily Active Timeline</h4>
            <p className="text-xs text-neutral-400">Minutes spent listening over the last 7 days</p>
          </div>
          
          <div className="flex h-44 items-end justify-between pt-6 px-2" id="daily-timeline-rack">
            {insights.recentActivityTimeline.map((item) => {
              const heightPct = (item.minutes / maxMinsInTimeline) * 100;
              return (
                <div key={item.dateStr} className="flex flex-col items-center flex-1 group">
                  <div className="relative w-full flex justify-center">
                    {/* Tooltip on hover */}
                    <span className="absolute -top-8 bg-neutral-950 text-white text-[10px] py-1 px-1.5 rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity font-mono pointer-events-none whitespace-nowrap z-15">
                      {item.minutes} mins
                    </span>
                    {/* Bar */}
                    <div
                      style={{ height: `${Math.max(4, heightPct)}%` }}
                      className={`w-4 sm:w-6 rounded-t-md transition-all group-hover:brightness-125 ${
                        accentColor === 'emerald' ? 'bg-emerald-500' :
                        accentColor === 'sky' ? 'bg-sky-500' :
                        accentColor === 'rose' ? 'bg-rose-500' :
                        accentColor === 'violet' ? 'bg-violet-500' :
                        accentColor === 'amber' ? 'bg-amber-500' :
                        accentColor === 'indigo' ? 'bg-indigo-500' : 'bg-teal-500'
                      }`}
                    />
                  </div>
                  <span className="text-[9.5px] text-neutral-400 mt-2 rotate-0 text-center uppercase tracking-tighter">
                    {item.dateStr}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hourly Heatmap */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-6 rounded-2xl space-y-4">
          <div>
            <h4 className="font-semibold text-white">Hourly Frequency Heatmap</h4>
            <p className="text-xs text-neutral-400">Distribution of listening events throughout the day</p>
          </div>

          <div className="flex h-44 items-end justify-between pt-6 px-1" id="hourly-heatmap-rack">
            {insights.hourlyActivity.map((count, hour) => {
              const heightPct = (count / maxHourlyPlays) * 100;
              return (
                <div key={hour} className="flex flex-col items-center flex-1 group" title={`${hour}:00 - ${count} plays`}>
                  <div className="relative w-full flex justify-center">
                    {/* Tooltip on hover */}
                    <span className="absolute -top-8 bg-neutral-950 text-white text-[10px] py-1 px-1.5 rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity font-mono pointer-events-none whitespace-nowrap z-15">
                      {count} plays
                    </span>
                    {/* Bar */}
                    <div
                      style={{ height: `${Math.max(3, heightPct)}%` }}
                      className={`w-2.5 rounded-t-sm transition-all group-hover:bg-opacity-100 ${
                        accentColor === 'emerald' ? 'bg-emerald-500/80' :
                        accentColor === 'sky' ? 'bg-sky-500/80' :
                        accentColor === 'rose' ? 'bg-rose-500/80' :
                        accentColor === 'violet' ? 'bg-violet-500/80' :
                        accentColor === 'amber' ? 'bg-amber-500/80' :
                        accentColor === 'indigo' ? 'bg-indigo-500/80' : 'bg-teal-500/80'
                      }`}
                    />
                  </div>
                  <span className="text-[8px] font-mono text-neutral-500 mt-2 block sm:inline">
                    {hour % 4 === 0 ? `${hour}h` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Songs, Artists, Genres */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="stats-metadata-breakdown-row">
        {/* Most Played Songs list */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-6 rounded-2xl flex flex-col justify-between h-[400px]">
          <div>
            <h4 className="font-semibold text-white mb-4">Most Played Tracks</h4>
            <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1" id="most-played-tracks-list">
              {insights.mostPlayedTracks.map(({ track, count }, index) => (
                <div
                  key={track.id}
                  onClick={() => onPlayTrack(track)}
                  className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
                >
                  <span className="w-5 font-mono text-xs text-neutral-500 group-hover:text-white transition-colors text-center font-bold">
                    {index + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center border border-white/5 overflow-hidden flex-shrink-0">
                    {track.artworkUrl ? (
                      <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Music size={14} className="text-neutral-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-neutral-200 truncate group-hover:text-white transition-colors">
                      {track.title}
                    </span>
                    <span className="block text-[10.5px] text-neutral-400 truncate">
                      {track.artist}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-neutral-400 font-mono bg-white/5 px-2 py-0.5 rounded-full">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Most Played Artists list */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-6 rounded-2xl flex flex-col justify-between h-[400px]">
          <div>
            <h4 className="font-semibold text-white mb-4">Most Played Artists</h4>
            <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1 mt-1" id="most-played-artists-list">
              {insights.mostPlayedArtists.map(({ name, count, percentage }, index) => (
                <div key={name} className="flex items-center space-x-3 p-1">
                  <span className="w-5 font-mono text-center text-xs text-neutral-500 font-bold">{index + 1}</span>
                  <div className={`w-8 h-8 rounded-full ${accentColorClass} flex items-center justify-center text-xs font-bold uppercase`}>
                    {name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-neutral-200 truncate">{name}</span>
                    <span className="block text-[10px] text-neutral-400">{count} qualifications</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">{percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Favorite Genres list */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-6 rounded-2xl flex flex-col justify-between h-[400px]">
          <div>
            <h4 className="font-semibold text-white mb-4">Acoustical Genres</h4>
            <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1" id="genres-breakdown-list">
              {insights.genresBreakdown.map(({ name, count, percentage }) => (
                <div key={name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-200 font-medium">{name}</span>
                    <span className="font-mono text-neutral-400">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${percentage}%` }}
                      className={`h-full rounded-full ${
                        accentColor === 'emerald' ? 'bg-emerald-500' :
                        accentColor === 'sky' ? 'bg-sky-500' :
                        accentColor === 'rose' ? 'bg-rose-500' :
                        accentColor === 'violet' ? 'bg-violet-500' :
                        accentColor === 'amber' ? 'bg-amber-500' :
                        accentColor === 'indigo' ? 'bg-indigo-500' : 'bg-teal-500'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
