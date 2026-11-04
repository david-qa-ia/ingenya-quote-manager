import { describe, expect, it } from 'vitest';
import { activityAuthorLabel } from './activityAuthor';

describe('activityAuthorLabel (SCRUM-120)', () => {
  it('shows the person, also for copied activity, and "Automático" only without one', () => {
    expect(activityAuthorLabel({ author: 'Daniel' })).toBe('Daniel');
    expect(activityAuthorLabel({ author: 'Sistema local' })).toBe('Automático');
    expect(activityAuthorLabel({ author: '  ' })).toBe('Automático');
  });
});
