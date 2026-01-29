'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, Team, RubricCriterion, Presentation, TeamWithMembers, Grade, Feedback } from '@/types';
import SetupPhase from './SetupPhase';
import PresentationPhase from './PresentationPhase';
import HistoryView from './HistoryView';

interface DashboardProps {
  userId: number;
}

export default function Dashboard({ userId }: DashboardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [currentView, setCurrentView] = useState<'setup' | 'presentation' | 'history'>('setup');
  const [activeTeam, setActiveTeam] = useState<TeamWithMembers | null>(null);
  const [activePresentation, setActivePresentation] = useState<Presentation | null>(null);

  // Load session data
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const response = await fetch('/api/session');
      const data = await response.json();

      if (data.session) {
        setSession(data.session);
        setTeams(data.teams.map((t: Team) => ({
          ...t,
          membersList: JSON.parse(t.members)
        })));
        setCriteria(data.criteria);
        setPresentations(data.presentations);

        // Check if there's an active presentation
        const active = data.presentations.find((p: Presentation) =>
          p.status === 'presenting' || p.status === 'qa' || p.status === 'emergency_stopped'
        );

        if (active) {
          const activeTeamData = data.teams.find((t: Team) => t.id === active.team_id);
          if (activeTeamData) {
            setActiveTeam({
              ...activeTeamData,
              membersList: JSON.parse(activeTeamData.members)
            });
            setActivePresentation(active);
            setCurrentView('presentation');
          }
        } else if (data.teams.length > 0 && data.criteria.length > 0) {
          // If teams and rubric are set up, show presentation view
          setCurrentView('presentation');
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load session:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleSessionCreated = (newSession: Session) => {
    setSession(newSession);
  };

  const handleTeamsAdded = (newTeams: TeamWithMembers[]) => {
    setTeams(prev => [...prev, ...newTeams]);
  };

  const handleCriteriaAdded = (newCriteria: RubricCriterion[]) => {
    setCriteria(newCriteria);
  };

  const handleStartSession = () => {
    if (teams.length === 0) {
      alert('Please add teams before starting the session');
      return;
    }
    if (criteria.length === 0) {
      alert('Please add rubric criteria before starting the session');
      return;
    }
    setCurrentView('presentation');
  };

  const handleNewSession = async () => {
    const confirmed = confirm(
      'Starting a new session will clear all current session data (teams, presentations, grades). Are you sure?'
    );

    if (!confirmed) return;

    try {
      // Delete current session
      if (session) {
        await fetch(`/api/session?sessionId=${session.id}`, {
          method: 'DELETE',
        });
      }

      // Reset state
      setSession(null);
      setTeams([]);
      setCriteria([]);
      setPresentations([]);
      setActiveTeam(null);
      setActivePresentation(null);
      setCurrentView('setup');

      // Reload to get fresh state
      await loadSession();
    } catch (error) {
      console.error('Failed to start new session:', error);
      alert('Failed to start new session');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Classroom Presentation Randomizer
            </h1>
            <div className="flex gap-4">
              {session && (
                <button
                  onClick={handleNewSession}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  New Session
                </button>
              )}
              {session && currentView === 'presentation' && (
                <>
                  <button
                    onClick={() => setCurrentView('history')}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    View History
                  </button>
                  <button
                    onClick={() => setCurrentView('setup')}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Settings
                  </button>
                </>
              )}
              {currentView === 'history' && (
                <button
                  onClick={() => setCurrentView('presentation')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Back to Presentation
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'setup' && (
          <SetupPhase
            session={session}
            teams={teams}
            criteria={criteria}
            onSessionCreated={handleSessionCreated}
            onTeamsAdded={handleTeamsAdded}
            onCriteriaAdded={handleCriteriaAdded}
            onStartSession={handleStartSession}
          />
        )}

        {currentView === 'presentation' && session && (
          <PresentationPhase
            session={session}
            teams={teams}
            criteria={criteria}
            presentations={presentations}
            activeTeam={activeTeam}
            activePresentation={activePresentation}
            onTeamSelected={(team, presentation) => {
              setActiveTeam(team);
              setActivePresentation(presentation);
            }}
            onPresentationUpdated={(presentation) => {
              setActivePresentation(presentation);
              setPresentations(prev =>
                prev.map(p => p.id === presentation.id ? presentation : p)
              );
            }}
            onTeamCompleted={() => {
              setActiveTeam(null);
              setActivePresentation(null);
              loadSession();
            }}
          />
        )}

        {currentView === 'history' && session && (
          <HistoryView
            session={session}
            teams={teams}
            criteria={criteria}
            presentations={presentations}
            onReload={loadSession}
          />
        )}
      </main>
    </div>
  );
}
