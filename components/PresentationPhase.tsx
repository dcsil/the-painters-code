'use client';

import { useState, useEffect, useRef } from 'react';
import type { Session, TeamWithMembers, RubricCriterion, Presentation } from '@/types';

interface PresentationPhaseProps {
  session: Session;
  teams: TeamWithMembers[];
  criteria: RubricCriterion[];
  presentations: Presentation[];
  activeTeam: TeamWithMembers | null;
  activePresentation: Presentation | null;
  onTeamSelected: (team: TeamWithMembers | null, presentation: Presentation | null) => void;
  onPresentationUpdated: (presentation: Presentation) => void;
  onTeamCompleted: () => void;
}

export default function PresentationPhase({
  session,
  teams,
  criteria,
  presentations,
  activeTeam,
  activePresentation,
  onTeamSelected,
  onPresentationUpdated,
  onTeamCompleted,
}: PresentationPhaseProps) {
  const [timerPhase, setTimerPhase] = useState<'presentation' | 'qa' | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [savedTimerState, setSavedTimerState] = useState<any>(null);

  // Grading state
  const [scores, setScores] = useState<{ [criterionId: number]: number }>({});
  const [publicFeedback, setPublicFeedback] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [showGrading, setShowGrading] = useState(false);

  // Rubric display state
  const [showRubric, setShowRubric] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved timer state if presentation was in progress
  useEffect(() => {
    if (activePresentation) {
      if (activePresentation.timer_state) {
        const state = JSON.parse(activePresentation.timer_state);
        setSavedTimerState(state);
        setTimerPhase(state.phase);
        setElapsedTime(state.elapsedTime);

        // AUTO-RESUME: If timer was active (in presentation or qa phase), restart it
        if (state.phase === 'presentation' || state.phase === 'qa') {
          setIsRunning(true);
        }
      } else {
        setSavedTimerState(null);
        setTimerPhase(null);
        setElapsedTime(0);
      }

      // Load existing grades if any
      loadGrades(activePresentation.id);
    }
  }, [activePresentation]);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          // Auto-save timer state every 5 seconds
          if (newTime % 5 === 0 && activePresentation) {
            saveTimerState(newTime);
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timerPhase, activePresentation]);

  const saveTimerState = async (time: number) => {
    if (!activePresentation) return;

    const state = {
      phase: timerPhase,
      elapsedTime: time,
      isRunning,
    };

    try {
      await fetch('/api/presentations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: activePresentation.id,
          timerState: state,
          ...(timerPhase === 'presentation' && { presentationTimeElapsed: time }),
          ...(timerPhase === 'qa' && { qaTimeElapsed: time }),
        }),
      });
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
  };

  const loadGrades = async (presentationId: number) => {
    try {
      const response = await fetch(`/api/grades?presentationId=${presentationId}`);
      const data = await response.json();

      if (response.ok && data.grades) {
        const scoreMap: { [key: number]: number } = {};
        data.grades.forEach((g: any) => {
          scoreMap[g.criterion_id] = g.score;
        });
        setScores(scoreMap);

        if (data.feedback) {
          setPublicFeedback(data.feedback.public_feedback || '');
          setPrivateNotes(data.feedback.private_notes || '');
        }
      }
    } catch (error) {
      console.error('Failed to load grades:', error);
    }
  };

  const handlePickNextTeam = async () => {
    // Lock rubric on first team selection
    if (!session.rubric_locked) {
      await fetch('/api/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          rubricLocked: true,
        }),
      });
    }

    try {
      const response = await fetch('/api/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });

      const data = await response.json();
      if (response.ok) {
        const team = teams.find(t => t.id === data.team.id);
        if (team && data.presentation) {
          onTeamSelected(team, data.presentation);
          setTimerPhase(null);
          setElapsedTime(0);
          setIsRunning(false);
          setShowGrading(false);
          setScores({});
          setPublicFeedback('');
          setPrivateNotes('');
          setSavedTimerState(null);
        }
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Failed to select team');
    }
  };

  const handleChooseDifferentTeam = () => {
    onTeamSelected(null, null);
    setTimerPhase(null);
    setElapsedTime(0);
    setIsRunning(false);
    setShowGrading(false);
    setScores({});
    setPublicFeedback('');
    setPrivateNotes('');
    setSavedTimerState(null);
  };

  const handleStartPresentation = async () => {
    if (!activePresentation || !activeTeam) return;

    setTimerPhase('presentation');
    setElapsedTime(0);
    setIsRunning(true);

    try {
      await fetch('/api/presentations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: activePresentation.id,
          teamId: activeTeam.id,
          status: 'presenting',
        }),
      });

      await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: activeTeam.id,
          status: 'presenting',
        }),
      });
    } catch (error) {
      console.error('Failed to start presentation:', error);
    }
  };

  const handleResumeFromSaved = async () => {
    if (savedTimerState && activePresentation) {
      setTimerPhase(savedTimerState.phase);
      setElapsedTime(savedTimerState.elapsedTime);
      setIsRunning(true);
      setSavedTimerState(null);

      // Update presentation status back to 'presenting' to hide emergency buttons
      try {
        await fetch('/api/presentations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presentationId: activePresentation.id,
            status: 'presenting'
          })
        });

        // Update parent state using onPresentationUpdated
        onPresentationUpdated({
          ...activePresentation,
          status: 'presenting'
        });
      } catch (error) {
        console.error('Failed to update presentation status:', error);
      }
    }
  };

  const handleStartFresh = async () => {
    setTimerPhase('presentation');
    setElapsedTime(0);
    setIsRunning(true);
    setSavedTimerState(null);

    // Update presentation status to in_progress
    if (activePresentation) {
      await fetch('/api/presentations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: activePresentation.id,
          status: 'in_progress',
          timerState: { phase: 'presentation', elapsedTime: 0 }
        })
      });

      // Update parent state
      if (activeTeam) {
        onTeamSelected(activeTeam, { ...activePresentation, status: 'in_progress' });
      }
    }
  };

  const handleStopAndGrade = () => {
    setIsRunning(false);
    if (activePresentation) {
      saveTimerState(elapsedTime);
    }
    setShowGrading(true);
  };

  const handleEmergencyStop = async () => {
    setIsRunning(false);
    setTimerPhase(null);  // Clear timerPhase to prevent initial buttons from showing
    if (activePresentation) {
      await saveTimerState(elapsedTime);
      await fetch('/api/presentations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: activePresentation.id,
          status: 'emergency_stopped',
        }),
      });

      // Update the presentation status in parent component
      onPresentationUpdated({
        ...activePresentation,
        status: 'emergency_stopped'
      });
    }
  };

  const handleDeferTeam = async () => {
    if (!activeTeam || !activePresentation) return;

    try {
      // Reset team to pending status
      await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: activeTeam.id,
          status: 'pending',
        }),
      });

      // DELETE the presentation record so a fresh one is created when team is picked again
      await fetch('/api/presentations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: activePresentation.id
        }),
      });

      onTeamSelected(null, null);
      setTimerPhase(null);
      setElapsedTime(0);
      setIsRunning(false);
      setSavedTimerState(null);
    } catch (error) {
      alert('Failed to defer team');
    }
  };

  const handleSwitchToQA = () => {
    setIsRunning(false);
    setTimerPhase('qa');
    setElapsedTime(0);
  };

  const handleStartQA = () => {
    setIsRunning(true);
  };

  const handleSubmitGrades = async () => {
    if (!activePresentation) return;

    // Validate all scores are provided and within range
    const allScoresValid = criteria.every(c => {
      const score = scores[c.id];
      return score !== undefined && score >= 0 && score <= c.max_score;
    });

    if (!allScoresValid) {
      alert('Please provide valid scores for all criteria');
      return;
    }

    const grades = criteria.map(c => ({
      criterionId: c.id,
      score: scores[c.id],
    }));

    try {
      const response = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: activePresentation.id,
          grades,
          publicFeedback,
          privateNotes,
        }),
      });

      if (response.ok) {
        // Mark presentation as completed
        await fetch('/api/presentations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presentationId: activePresentation.id,
            teamId: activeTeam?.id,
            status: 'completed',
          }),
        });

        await fetch('/api/teams', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: activeTeam?.id,
            status: 'completed',
          }),
        });

        onTeamCompleted();
      } else {
        alert('Failed to submit grades');
      }
    } catch (error) {
      alert('Failed to submit grades');
    }
  };

  const formatTime = (seconds: number) => {
    const isNegative = seconds < 0;
    const abs = Math.abs(seconds);
    const mins = Math.floor(abs / 60);
    const secs = abs % 60;
    return `${isNegative ? '-' : ''}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (!timerPhase) return 'text-gray-900';

    const maxTime = timerPhase === 'presentation'
      ? session.presentation_duration * 60
      : session.qa_duration * 60;

    const remaining = maxTime - elapsedTime;

    if (remaining < 0) {
      return 'text-red-600';
    } else if (remaining <= 120) { // 2 minutes warning
      return 'text-yellow-600';
    }
    return 'text-green-600';
  };

  const getRemainingTime = () => {
    if (!timerPhase) return 0;

    const maxTime = timerPhase === 'presentation'
      ? session.presentation_duration * 60
      : session.qa_duration * 60;

    return maxTime - elapsedTime;
  };

  const pendingCount = teams.filter(t => t.status === 'pending').length;
  const completedCount = teams.filter(t => t.status === 'completed').length;
  const totalScore = criteria.reduce((sum, c) => sum + (Number(scores[c.id]) || 0), 0);
  const maxTotalScore = criteria.reduce((sum, c) => sum + Number(c.max_score), 0);

  return (
    <div className="space-y-6">
      {/* Session Info - Only show when no active team */}
      {!activeTeam && (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Session Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Session Name</p>
            <p className="text-lg font-semibold text-gray-900">{session.name}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Timer Settings</p>
            <p className="text-lg font-semibold text-gray-900">
              {session.presentation_duration} min presentation / {session.qa_duration} min Q&A
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Rubric</p>
            <p className="text-lg font-semibold text-gray-900">
              {criteria.length} criteria, max {maxTotalScore} points
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Pick Next Team - Centered button when no active team */}
      {!activeTeam && pendingCount > 0 && (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <button
            onClick={handlePickNextTeam}
            className="px-8 py-4 bg-blue-600 text-white text-xl font-semibold rounded-md hover:bg-blue-700"
          >
            Pick Next Team
          </button>
        </div>
      )}

      {/* Status Bar */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-8">
            <div>
              <span className="text-sm text-gray-600">Pending:</span>
              <span className="ml-2 text-lg font-semibold text-blue-600">{pendingCount}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Completed:</span>
              <span className="ml-2 text-lg font-semibold text-green-600">{completedCount}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Total:</span>
              <span className="ml-2 text-lg font-semibold text-gray-900">{teams.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Team List - Only show when no active team */}
      {!activeTeam && (
      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">All Teams</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map(team => (
            <div
              key={team.id}
              className={`border-2 rounded p-3 ${
                team.status === 'completed' ? 'border-green-500 bg-green-50' :
                team.status === 'presenting' ? 'border-blue-500 bg-blue-50' :
                'border-gray-300 bg-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{team.name}</p>
                  <p className="text-sm text-gray-600">{team.membersList.join(', ')}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  team.status === 'completed' ? 'bg-green-200 text-green-800' :
                  team.status === 'presenting' ? 'bg-blue-200 text-blue-800' :
                  'bg-gray-200 text-gray-700'
                }`}>
                  {team.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Active Team Display */}
      {activeTeam && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center mb-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{activeTeam.name}</h2>
            <p className="text-lg text-gray-600">{activeTeam.membersList.join(', ')}</p>
          </div>

          {/* Timer Display */}
          {timerPhase && (
            <div className="text-center mb-4">
              <div className={`text-6xl font-bold ${getTimerColor()}`}>
                {formatTime(getRemainingTime())}
              </div>
              <div className="text-lg text-gray-600 mt-1">
                {timerPhase === 'presentation' ? 'Presentation Time' : 'Q&A Time'}
                {getRemainingTime() < 0 && ' (Overtime)'}
                {getRemainingTime() > 0 && getRemainingTime() <= 120 && (
                  <span className="ml-2 text-yellow-600 font-semibold">
                    ⚠️ 2 Minutes Left
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Rubric Reference - Show during active timer */}
          {timerPhase && !showGrading && (
            <div className="mt-4 mb-4 border-t pt-4">
              <button
                onClick={() => setShowRubric(!showRubric)}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-2"
              >
                <span>{showRubric ? '▼' : '▶'}</span>
                <span>Rubric Reference</span>
              </button>
              {showRubric && (
                <div className="mt-3 space-y-2">
                  {criteria.map(criterion => (
                    <div key={criterion.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-gray-900">{criterion.name}</div>
                        <div className="text-sm text-gray-600 font-medium">Max: {criterion.max_score} pts</div>
                      </div>
                      {criterion.description && (
                        <div className="text-sm text-gray-600 mt-1">{criterion.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-4 flex-wrap">
            {!timerPhase && savedTimerState && (
              <>
                <button
                  onClick={handleResumeFromSaved}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
                >
                  Resume from Saved State
                </button>
                <button
                  onClick={handleStartFresh}
                  className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700"
                >
                  Start Fresh
                </button>
              </>
            )}

            {!timerPhase && !savedTimerState && (
              <>
                <button
                  onClick={handleStartPresentation}
                  className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 text-lg"
                >
                  Start Presentation
                </button>
                <button
                  onClick={handleChooseDifferentTeam}
                  className="px-6 py-3 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700"
                >
                  Choose Different Team
                </button>
              </>
            )}

            {timerPhase === 'presentation' && isRunning && (
              <>
                <button
                  onClick={handleSwitchToQA}
                  className="px-8 py-4 bg-blue-600 text-white font-semibold text-lg rounded-md hover:bg-blue-700"
                >
                  Start Q&A
                </button>
                <button
                  onClick={handleEmergencyStop}
                  className="px-6 py-3 bg-red-600 text-white font-medium rounded-md hover:bg-red-700"
                >
                  Emergency Stop
                </button>
              </>
            )}

            {timerPhase === 'qa' && !isRunning && (
              <button
                onClick={handleStartQA}
                className="px-8 py-4 bg-green-600 text-white font-semibold text-lg rounded-md hover:bg-green-700"
              >
                Start Q&A Timer
              </button>
            )}

            {timerPhase === 'qa' && isRunning && (
              <button
                onClick={handleStopAndGrade}
                className="px-8 py-4 bg-purple-600 text-white font-semibold text-lg rounded-md hover:bg-purple-700"
              >
                Stop & Grade
              </button>
            )}

            {activePresentation?.status === 'emergency_stopped' && (
              <>
                <button
                  onClick={handleResumeFromSaved}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
                >
                  Resume Timer
                </button>
                <button
                  onClick={handleStartFresh}
                  className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700"
                >
                  Reset Timer
                </button>
                <button
                  onClick={handleDeferTeam}
                  className="px-6 py-3 bg-yellow-600 text-white font-medium rounded-md hover:bg-yellow-700"
                >
                  Defer Team
                </button>
              </>
            )}
          </div>

          {/* Notes Section - Always visible during presentation */}
          {!showGrading && timerPhase && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Public Feedback
                  </label>
                  <textarea
                    value={publicFeedback}
                    onChange={(e) => setPublicFeedback(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-gray-900 text-sm"
                    rows={3}
                    placeholder="Good eye contact, weak conclusion..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Private Notes
                  </label>
                  <textarea
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-gray-900 text-sm"
                    rows={3}
                    placeholder="Personal observations..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Grading Interface */}
          {showGrading && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Grading</h3>

              <div className="space-y-4 mb-6">
                {criteria.map(criterion => (
                  <div key={criterion.id} className="flex items-center justify-between border-b pb-3">
                    <div className="flex-1">
                      <span className="font-medium text-lg text-gray-900">{criterion.name}</span>
                      <span className="ml-2 text-sm text-gray-600">
                        (Max: {criterion.max_score})
                      </span>
                    </div>
                    <input
                      type="number"
                      value={scores[criterion.id] || ''}
                      onChange={(e) => setScores(prev => ({
                        ...prev,
                        [criterion.id]: parseFloat(e.target.value) || 0
                      }))}
                      step="0.1"
                      min="0"
                      max={criterion.max_score}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md text-lg text-gray-900"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-semibold text-gray-900">Total Score:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {totalScore.toFixed(1)} / {maxTotalScore}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Public Feedback (Student will see this)
                  </label>
                  <textarea
                    value={publicFeedback}
                    onChange={(e) => setPublicFeedback(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    rows={3}
                    placeholder="e.g., Good eye contact, weak conclusion"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Private Notes (For your records only)
                  </label>
                  <textarea
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    rows={3}
                    placeholder="Personal observations..."
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSubmitGrades}
                  className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 text-lg"
                >
                  Submit Grade
                </button>
                <button
                  onClick={() => setShowGrading(false)}
                  className="px-6 py-3 bg-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!activeTeam && pendingCount === 0 && completedCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold text-green-800 mb-2">
            All Presentations Complete!
          </h2>
          <p className="text-lg text-green-700">
            All {teams.length} teams have finished presenting.
          </p>
        </div>
      )}
    </div>
  );
}
