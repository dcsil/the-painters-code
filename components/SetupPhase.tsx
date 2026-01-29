'use client';

import { useState } from 'react';
import type { Session, TeamWithMembers, RubricCriterion } from '@/types';

interface SetupPhaseProps {
  session: Session | null;
  teams: TeamWithMembers[];
  criteria: RubricCriterion[];
  onSessionCreated: (session: Session) => void;
  onTeamsAdded: (teams: TeamWithMembers[]) => void;
  onCriteriaAdded: (criteria: RubricCriterion[]) => void;
  onStartSession: () => void;
}

export default function SetupPhase({
  session,
  teams,
  criteria,
  onSessionCreated,
  onTeamsAdded,
  onCriteriaAdded,
  onStartSession,
}: SetupPhaseProps) {
  // Session creation
  const [sessionName, setSessionName] = useState('');
  const [presentationDuration, setPresentationDuration] = useState(10);
  const [qaDuration, setQaDuration] = useState(5);

  // Team management
  const [bulkTeams, setBulkTeams] = useState('');
  const [manualTeamName, setManualTeamName] = useState('');
  const [manualTeamMembers, setManualTeamMembers] = useState('');

  // Rubric management
  const [bulkRubric, setBulkRubric] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  const [error, setError] = useState('');

  const handleCreateSession = async () => {
    if (!sessionName) {
      setError('Session name is required');
      return;
    }

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName,
          presentationDuration,
          qaDuration,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onSessionCreated(data.session);
        setError('');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to create session');
    }
  };

  const handleBulkAddTeams = async () => {
    if (!session) {
      setError('Please create a session first');
      return;
    }

    if (!bulkTeams.trim()) {
      setError('Please paste team data');
      return;
    }

    // Parse CSV format: Team Name, Member1, Member2, ...
    const lines = bulkTeams.trim().split('\n');
    const teamsToAdd = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        name: parts[0],
        members: parts.slice(1),
      };
    }).filter(t => t.name && t.members.length > 0);

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          teams: teamsToAdd,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const newTeams = data.teams.map((t: any) => ({
          ...t,
          membersList: JSON.parse(t.members)
        }));
        onTeamsAdded(newTeams);
        setBulkTeams('');
        setError('');
        if (data.errors.length > 0) {
          setError(data.errors.join(', '));
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to add teams');
    }
  };

  const handleManualAddTeam = async () => {
    if (!session) {
      setError('Please create a session first');
      return;
    }

    if (!manualTeamName || !manualTeamMembers) {
      setError('Team name and members are required');
      return;
    }

    const members = manualTeamMembers.split(',').map(m => m.trim()).filter(m => m);

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          teams: [{ name: manualTeamName, members }],
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const newTeams = data.teams.map((t: any) => ({
          ...t,
          membersList: JSON.parse(t.members)
        }));
        onTeamsAdded(newTeams);
        setManualTeamName('');
        setManualTeamMembers('');
        setError('');
        if (data.errors.length > 0) {
          setError(data.errors.join(', '));
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to add team');
    }
  };

  const handleBulkAddRubric = async () => {
    if (!session) {
      setError('Please create a session first');
      return;
    }

    if (session.rubric_locked) {
      setError('Rubric is locked');
      return;
    }

    if (!bulkRubric.trim()) {
      setError('Please enter rubric criteria');
      return;
    }

    // Parse format: Name | Description | Max Score
    const lines = bulkRubric.trim().split('\n');
    const criteriaToAdd = lines.map(line => {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length !== 3) {
        return null;
      }
      return {
        name: parts[0],
        description: parts[1],
        maxScore: parseFloat(parts[2]),
      };
    }).filter(c => c && c.name && !isNaN(c.maxScore));

    if (criteriaToAdd.length === 0) {
      setError('Invalid format. Use: Name | Description | Max Score (one per line)');
      return;
    }

    try {
      const response = await fetch('/api/rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          criteria: criteriaToAdd,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onCriteriaAdded(data.criteria);
        setBulkRubric('');
        setError('');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to add criteria');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName || criteria.length === 0) {
      setError('Template name and criteria are required');
      return;
    }

    try {
      const response = await fetch('/api/rubric/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          criteria: criteria.map(c => ({
            name: c.name,
            description: c.description || '',
            maxScore: c.max_score,
          })),
        }),
      });

      if (response.ok) {
        setTemplateName('');
        alert('Template saved successfully');
      } else {
        setError('Failed to save template');
      }
    } catch (err) {
      setError('Failed to save template');
    }
  };

  const handleLoadTemplates = async () => {
    try {
      const response = await fetch('/api/rubric');
      const data = await response.json();
      if (response.ok) {
        setTemplates(data.templates);
        setShowTemplates(true);
      }
    } catch (err) {
      setError('Failed to load templates');
    }
  };

  const handleApplyTemplate = async (template: any) => {
    if (!session) {
      setError('Please create a session first');
      return;
    }

    if (session.rubric_locked) {
      setError('Rubric is locked');
      return;
    }

    const templateCriteria = JSON.parse(template.criteria);

    try {
      const response = await fetch('/api/rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          criteria: templateCriteria,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onCriteriaAdded(data.criteria);
        setShowTemplates(false);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to apply template');
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Session Creation */}
      {!session && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Session</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Name
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                placeholder="e.g., CSC491 Week 5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Presentation Duration (minutes)
                </label>
                <input
                  type="number"
                  value={presentationDuration}
                  onChange={(e) => setPresentationDuration(Number(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Q&A Duration (minutes)
                </label>
                <input
                  type="number"
                  value={qaDuration}
                  onChange={(e) => setQaDuration(Number(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  min="1"
                />
              </div>
            </div>
            <button
              onClick={handleCreateSession}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Session
            </button>
          </div>
        </div>
      )}

      {session && (
        <>
          {/* Team Management */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Roster Management</h2>

            {/* Bulk Import */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Bulk Import (CSV)</h3>
              <p className="text-sm text-gray-600 mb-2">
                Format: Team Name, Member 1, Member 2, Member 3...
              </p>
              <textarea
                value={bulkTeams}
                onChange={(e) => setBulkTeams(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                rows={6}
                placeholder="Team A, Alice Smith, Bob Jones&#10;Team B, Carol White, Dave Brown, Eve Green"
              />
              <button
                onClick={handleBulkAddTeams}
                className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Add Teams
              </button>
            </div>

            {/* Manual Entry */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Manual Entry</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={manualTeamName}
                  onChange={(e) => setManualTeamName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  placeholder="Team Name"
                />
                <input
                  type="text"
                  value={manualTeamMembers}
                  onChange={(e) => setManualTeamMembers(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  placeholder="Members (comma-separated)"
                />
                <button
                  onClick={handleManualAddTeam}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Add Team
                </button>
              </div>
            </div>

            {/* Team List */}
            {teams.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-2">Teams ({teams.length})</h3>
                <div className="space-y-2">
                  {teams.map(team => (
                    <div key={team.id} className="border border-gray-200 rounded p-3">
                      <p className="font-medium text-gray-900">{team.name}</p>
                      <p className="text-sm text-gray-600">
                        {team.membersList.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rubric Builder */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Rubric Builder</h2>
              {session.rubric_locked && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded">
                  Locked
                </span>
              )}
            </div>

            {!session.rubric_locked && (
              <>
                <div className="mb-4">
                  <button
                    onClick={handleLoadTemplates}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Load Template
                  </button>
                </div>

                {showTemplates && (
                  <div className="mb-6 border border-gray-200 rounded p-4">
                    <h3 className="text-lg font-medium mb-2">Select Template</h3>
                    {templates.length === 0 ? (
                      <p className="text-gray-600">No templates saved</p>
                    ) : (
                      <div className="space-y-2">
                        {templates.map(template => (
                          <div key={template.id} className="flex justify-between items-center p-2 border rounded">
                            <span>{template.name}</span>
                            <button
                              onClick={() => handleApplyTemplate(template)}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                            >
                              Apply
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowTemplates(false)}
                      className="mt-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Close
                    </button>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Bulk Entry</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Format (one per line): Name | Description | Max Score
                  </p>
                  <div className="text-sm text-gray-500 mb-2 font-mono bg-gray-50 p-2 rounded">
                    Example:<br />
                    Technical Depth | Quality of technical implementation | 10<br />
                    Presentation Style | Clarity and engagement | 10<br />
                    Q&A Performance | Ability to answer questions | 5
                  </div>
                  <textarea
                    value={bulkRubric}
                    onChange={(e) => setBulkRubric(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    rows={8}
                    placeholder="Technical Depth | Quality of technical implementation | 10&#10;Presentation Style | Clarity and engagement | 10&#10;Q&A Performance | Ability to answer questions | 5"
                  />
                  <button
                    onClick={handleBulkAddRubric}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Criteria
                  </button>
                </div>
              </>
            )}

            {/* Criteria List */}
            {criteria.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Criteria ({criteria.length})</h3>
                <div className="space-y-2">
                  {criteria.map(criterion => (
                    <div key={criterion.id} className="border border-gray-200 rounded p-3">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-gray-900">{criterion.name}</span>
                        <span className="text-gray-600">Max: {criterion.max_score}</span>
                      </div>
                      {criterion.description && (
                        <p className="text-sm text-gray-600">{criterion.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!session.rubric_locked && criteria.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-2">Save as Template</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    placeholder="Template Name"
                  />
                  <button
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Start Button */}
          {teams.length > 0 && criteria.length > 0 && (
            <button
              onClick={onStartSession}
              className="w-full px-6 py-3 bg-green-600 text-white text-lg font-semibold rounded-md hover:bg-green-700"
            >
              Start Presentation Session
            </button>
          )}
        </>
      )}
    </div>
  );
}
