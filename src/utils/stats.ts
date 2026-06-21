import { Track, PlayHistoryEntry } from '../types';

export interface ListeningInsights {
  totalMinutes: number;
  totalPlays: number;
  uniquenessScore: number; // Percentage of songs in library played
  mostPlayedTracks: { track: Track; count: number }[];
  mostPlayedArtists: { name: string; count: number; percentage: number }[];
  genresBreakdown: { name: string; count: number; percentage: number }[];
  hourlyActivity: number[]; // 24 values representing play triggers per hour
  recentActivityTimeline: { dateStr: string; minutes: number }[]; // last 7 days of minutes
}

export function calculateListeningInsights(
  tracks: Track[],
  history: PlayHistoryEntry[]
): ListeningInsights {
  const totalPlays = history.length;
  
  // Total minutes from play history
  const totalMinutes = Math.round(
    history.reduce((sum, entry) => sum + (entry.listenDuration || 0), 0) / 60
  );

  // Track map for lookup
  const trackMap = new Map<string, Track>();
  tracks.forEach((t) => trackMap.set(t.id, t));

  // Count song frequencies
  const trackPlayCounts = new Map<string, number>();
  const artistPlayCounts = new Map<string, number>();
  const genrePlayCounts = new Map<string, number>();
  const hourlyActivity = Array(24).fill(0);

  // Parse chronological entries
  history.forEach((entry) => {
    // Frequencies
    trackPlayCounts.set(entry.trackId, (trackPlayCounts.get(entry.trackId) || 0) + 1);
    
    const track = trackMap.get(entry.trackId);
    if (track) {
      // Artist frequency
      const artist = track.artist || 'Unknown Artist';
      artistPlayCounts.set(artist, (artistPlayCounts.get(artist) || 0) + 1);

      // Genre frequency
      const genre = track.genre || 'Unknown Genre';
      genrePlayCounts.set(genre, (genrePlayCounts.get(genre) || 0) + 1);
    }

    // Hour heatmap
    try {
      const date = new Date(entry.playedAt);
      const hour = date.getHours();
      if (hour >= 0 && hour < 24) {
        hourlyActivity[hour] += 1;
      }
    } catch (e) {
      // safe fallback
    }
  });

  // Unique songs played ratio
  const uniquelyPlayedCount = trackPlayCounts.size;
  const uniquenessScore = tracks.length > 0 ? Math.round((uniquelyPlayedCount / tracks.length) * 100) : 0;

  // Most played tracks sorted output
  const mostPlayedTracks = Array.from(trackPlayCounts.entries())
    .map(([trackId, count]) => ({
      track: trackMap.get(trackId)!,
      count,
    }))
    .filter((entry) => !!entry.track)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Most played artists sorted output
  const totalArtistTriggers = Array.from(artistPlayCounts.values()).reduce((a, b) => a + b, 0) || 1;
  const mostPlayedArtists = Array.from(artistPlayCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalArtistTriggers) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Genres sorted output
  const totalGenreTriggers = Array.from(genrePlayCounts.values()).reduce((a, b) => a + b, 0) || 1;
  const genresBreakdown = Array.from(genrePlayCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalGenreTriggers) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 7-day activity timeline
  const recentActivityTimeline: { dateStr: string; minutes: number }[] = [];
  const currentDate = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(currentDate.getDate() - i);
    const dateKey = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    
    // Sum duration for that day (local timestamp comparison)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    
    const daySeconds = history
      .filter((entry) => entry.playedAt >= dayStart && entry.playedAt < dayEnd)
      .reduce((sum, entry) => sum + (entry.listenDuration || 0), 0);

    recentActivityTimeline.push({
      dateStr: dateKey,
      minutes: Math.ceil(daySeconds / 60),
    });
  }

  return {
    totalMinutes,
    totalPlays,
    uniquenessScore,
    mostPlayedTracks,
    mostPlayedArtists,
    genresBreakdown,
    hourlyActivity,
    recentActivityTimeline,
  };
}
