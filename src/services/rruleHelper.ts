import {RRule, rrulestr} from 'rrule';

/**
 * Expands an RRULE string into an array of occurrence dates
 * between dtstart and the given end date.
 */
export function expandRRule(
  rruleString: string,
  dtstart: Date,
  until: Date,
): Date[] {
  try {
    const rule = rrulestr(rruleString, {dtstart});
    return rule.between(
      new Date(dtstart.getTime() - 1),
      new Date(until.getTime() + 86400000),
      true,
    );
  } catch (error) {
    console.error('Error expanding RRULE:', error);
    return [];
  }
}

/**
 * Creates an RRule object from user-friendly parameters.
 */
export function buildRRule(params: {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  byDay?: number[]; // 0=MO, 1=TU, ..., 6=SU (RRule.MO etc.)
  count?: number;
  until?: Date;
}): string {
  const freqMap = {
    DAILY: RRule.DAILY,
    WEEKLY: RRule.WEEKLY,
    MONTHLY: RRule.MONTHLY,
    YEARLY: RRule.YEARLY,
  };

  const dayMap = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];

  const options: any = {
    freq: freqMap[params.freq],
    interval: params.interval || 1,
  };

  if (params.byDay && params.byDay.length > 0) {
    options.byweekday = params.byDay.map(d => dayMap[d]);
  }

  if (params.count) {
    options.count = params.count;
  }

  if (params.until) {
    options.until = params.until;
  }

  const rule = new RRule(options);
  return rule.toString().replace('RRULE:', '');
}

/**
 * Returns a human-readable description of an RRULE string.
 */
export function describeRRule(rruleString: string, dtstart: Date): string {
  try {
    const rule = rrulestr(rruleString, {dtstart});
    return rule.toText();
  } catch {
    return rruleString;
  }
}
