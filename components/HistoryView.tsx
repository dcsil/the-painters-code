'use client';

import { useState, useEffect } from 'react';
import type { Session, TeamWithMembers, RubricCriterion, Presentation, Grade, Feedback } from '@/types';

interface HistoryViewProps {
  session: Session;
  teams: TeamWithMembers[];
  criteria: RubricCriterion[];
  presentations: Presentation[];
  onReload: () => void;
}

interface PresentationWithGrades extends Presentation {
  team: TeamWithMembers;
  grades: Grade[];
  feedback: Feedback | null;
}

export default function HistoryView({
  session,
  teams,
  criteria,
  presentations,
  onReload,
}: HistoryViewProps) {
  const [completedPresentations, setCompletedPresentations] = useState<PresentationWithGrades[]>([]);
  const [editingPresentation, setEditingPresentation] = useState<PresentationWithGrades | null>(null);
  const [scores, setScores] = useState<{ [criterionId: number]: number }>({});
  const [publicFeedback, setPublicFeedback] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCompletedPresentations();
  }, [presentations, teams]);

  const loadCompletedPresentations = async () => {
    const completed = presentations.filter(p => p.status === 'completed');
    const withDetails: PresentationWithGrades[] = [];

    for (const presentation of completed) {
      let team = teams.find(t => t.id === presentation.team_id);

      // Fallback if team not found (shouldn't happen, but prevents data loss)
      if (!team) {
        console.warn(`Team ${presentation.team_id} not found for presentation ${presentation.id}`);
        team = {
          id: presentation.team_id,
          name: `Team ${presentation.team_id} (Missing)`,
          members: '[]',
          membersList: [],
          status: 'completed',
          session_id: presentation.session_id,
          created_at: '',
          updated_at: ''
        } as TeamWithMembers;
      }

      try {
        const response = await fetch(`/api/grades?presentationId=${presentation.id}`);
        const data = await response.json();

        withDetails.push({
          ...presentation,
          team,
          grades: data.grades || [],
          feedback: data.feedback || null,
        });
      } catch (error) {
        console.error('Failed to load grades:', error);
      }
    }

    setCompletedPresentations(withDetails);
  };

  const handleEditPresentation = (presentation: PresentationWithGrades) => {
    setEditingPresentation(presentation);

    // Load grades into state
    const scoreMap: { [key: number]: number } = {};
    presentation.grades.forEach(g => {
      scoreMap[g.criterion_id] = Number(g.score);
    });
    setScores(scoreMap);

    setPublicFeedback(presentation.feedback?.public_feedback || '');
    setPrivateNotes(presentation.feedback?.private_notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingPresentation) return;

    // Validate scores
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

    setLoading(true);

    try {
      const response = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: editingPresentation.id,
          grades,
          publicFeedback,
          privateNotes,
        }),
      });

      if (response.ok) {
        alert('Grades updated successfully');
        setEditingPresentation(null);
        await loadCompletedPresentations();
        onReload();
      } else {
        alert('Failed to update grades');
      }
    } catch (error) {
      alert('Failed to update grades');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    window.location.href = `/api/export?sessionId=${session.id}`;
  };

  const calculateTotalScore = (grades: Grade[]) => {
    return grades.reduce((sum, g) => sum + Number(g.score), 0);
  };

  const getMaxTotalScore = () => {
    return criteria.reduce((sum, c) => sum + Number(c.max_score), 0);
  };

  const currentEditTotal = criteria.reduce((sum, c) => sum + (Number(scores[c.id]) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Presentation History</h2>
        {completedPresentations.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700"
          >
            Export to CSV
          </button>
        )}
      </div>

      {completedPresentations.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No completed presentations yet.</p>
        </div>
      )}

      {completedPresentations.map(presentation => (
        <div key={presentation.id} className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{presentation.team.name}</h3>
              <p className="text-gray-600">{presentation.team.membersList.join(', ')}</p>
              {presentation.ended_at && (
                <p className="text-sm text-gray-500 mt-1">
                  Completed: {new Date(presentation.ended_at).toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={() => handleEditPresentation(presentation)}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
            >
              Edit Grades
            </button>
          </div>

          {editingPresentation?.id === presentation.id ? (
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Edit Grades</h4>

              <div className="space-y-3 mb-6">
                {criteria.map(criterion => (
                  <div key={criterion.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{criterion.name}</span>
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
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total Score:</span>
                  <span className="text-xl font-bold text-blue-600">
                    {currentEditTotal.toFixed(1)} / {getMaxTotalScore()}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Public Feedback
                  </label>
                  <textarea
                    value={publicFeedback}
                    onChange={(e) => setPublicFeedback(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Private Notes
                  </label>
                  <textarea
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditingPresentation(null)}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {presentation.grades.map(grade => {
                  const criterion = criteria.find(c => c.id === grade.criterion_id);
                  if (!criterion) return null;
                  return (
                    <div key={grade.id} className="flex justify-between border-b pb-2">
                      <span className="text-gray-700">{criterion.name}:</span>
                      <span className="font-medium">
                        {grade.score} / {criterion.max_score}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total Score:</span>
                  <span className="text-xl font-bold text-blue-600">
                    {calculateTotalScore(presentation.grades).toFixed(1)} / {getMaxTotalScore()}
                  </span>
                </div>
              </div>

              {presentation.feedback && (
                <div className="space-y-3">
                  {presentation.feedback.public_feedback && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Public Feedback:</span>
                      <p className="text-gray-600 mt-1">{presentation.feedback.public_feedback}</p>
                    </div>
                  )}
                  {presentation.feedback.private_notes && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Private Notes:</span>
                      <p className="text-gray-600 mt-1">{presentation.feedback.private_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {presentation.feedback && presentation.feedback.updated_at !== presentation.feedback.created_at && (
                <p className="text-xs text-gray-500 mt-2">
                  Last edited: {new Date(presentation.feedback.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
