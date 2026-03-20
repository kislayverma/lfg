/**
 * Mood data constants.
 *
 * Moods are organized into five intuitive categories -- Awesome, Good,
 * Ok, Bad, and Awful -- each represented by an emoji. Within every
 * category there are fine-grained mood labels the user can pick from.
 *
 * The categories map loosely to energy/pleasantness:
 *   Awesome  -> high energy, very pleasant
 *   Good     -> moderate energy, pleasant
 *   Ok       -> neutral / mixed
 *   Bad      -> unpleasant, moderate energy
 *   Awful    -> high distress / very unpleasant
 */

export type MoodCategoryId =
  | 'awesome'
  | 'good'
  | 'ok'
  | 'bad'
  | 'awful';

export interface MoodCategory {
  id: MoodCategoryId;
  label: string;
  emoji: string;
  /** Accent color used for selection highlights and badges */
  color: string;
  moods: MoodItem[];
}

export interface MoodItem {
  name: string;
  description: string;
}

export const MOOD_CATEGORIES: MoodCategory[] = [
  {
    id: 'awesome',
    label: 'Awesome',
    emoji: '\u{1F929}', // star-struck
    color: '#F5A623',
    moods: [
      {name: 'Ecstatic', description: 'Feeling overwhelming happiness and delight'},
      {name: 'Thrilled', description: 'Feeling a sudden wave of excitement'},
      {name: 'Euphoric', description: 'Feeling intensely happy, almost dreamlike'},
      {name: 'Inspired', description: 'Feeling creatively stimulated and driven'},
      {name: 'Energized', description: 'Feeling active, vibrant, and full of energy'},
      {name: 'Proud', description: 'Feeling deep satisfaction in achievements'},
      {name: 'Passionate', description: 'Feeling intense enthusiasm and devotion'},
      {name: 'Confident', description: 'Feeling self-assured and certain'},
      {name: 'Playful', description: 'Feeling light-hearted and full of fun'},
      {name: 'Amazed', description: 'Feeling wonderstruck and astonished'},
      {name: 'Elated', description: 'Feeling extremely happy and exhilarated'},
      {name: 'Victorious', description: 'Feeling triumphant after overcoming a challenge'},
    ],
  },
  {
    id: 'good',
    label: 'Good',
    emoji: '\u{1F60A}', // smiling face with smiling eyes
    color: '#7ED321',
    moods: [
      {name: 'Happy', description: 'Feeling pleased and content'},
      {name: 'Grateful', description: 'Feeling thankful and appreciative'},
      {name: 'Cheerful', description: 'Feeling noticeably happy and optimistic'},
      {name: 'Optimistic', description: 'Feeling hopeful about what is ahead'},
      {name: 'Calm', description: 'Feeling free of stress and worry'},
      {name: 'Relaxed', description: 'Feeling free from tension and at ease'},
      {name: 'Content', description: 'Feeling satisfied and at peace with things'},
      {name: 'Motivated', description: 'Feeling driven and ready to take action'},
      {name: 'Curious', description: 'Feeling eager to learn or explore'},
      {name: 'Loved', description: 'Feeling deeply cared for and valued'},
      {name: 'Hopeful', description: 'Feeling gently optimistic about the future'},
      {name: 'Focused', description: 'Feeling directed and concentrated'},
    ],
  },
  {
    id: 'ok',
    label: 'Ok',
    emoji: '\u{1F610}', // neutral face
    color: '#9B9B9B',
    moods: [
      {name: 'Fine', description: 'Feeling neither good nor bad, just okay'},
      {name: 'Meh', description: 'Feeling indifferent and unenthusiastic'},
      {name: 'Bored', description: 'Feeling weary from lack of interest'},
      {name: 'Distracted', description: 'Having trouble staying focused'},
      {name: 'Restless', description: 'Feeling unable to settle or relax'},
      {name: 'Thoughtful', description: 'Feeling reflective and contemplative'},
      {name: 'Uncertain', description: 'Feeling unsure about what is next'},
      {name: 'Mixed', description: 'Feeling a blend of positive and negative'},
      {name: 'Tired', description: 'Feeling in need of rest or sleep'},
      {name: 'Apathetic', description: 'Feeling indifferent and lacking motivation'},
      {name: 'Nostalgic', description: 'Feeling wistful about the past'},
      {name: 'Numb', description: 'Feeling unable to think or feel clearly'},
    ],
  },
  {
    id: 'bad',
    label: 'Bad',
    emoji: '\u{1F61E}', // disappointed face
    color: '#E07C4F',
    moods: [
      {name: 'Sad', description: 'Feeling unhappy and sorrowful'},
      {name: 'Stressed', description: 'Feeling under mental or emotional pressure'},
      {name: 'Anxious', description: 'Feeling worried, nervous, or uneasy'},
      {name: 'Frustrated', description: 'Feeling upset at being unable to change something'},
      {name: 'Irritated', description: 'Feeling annoyed or impatient'},
      {name: 'Lonely', description: 'Feeling isolated and without companionship'},
      {name: 'Disappointed', description: 'Feeling let down by unmet expectations'},
      {name: 'Insecure', description: 'Feeling uncertain about yourself'},
      {name: 'Guilty', description: 'Feeling responsible for a wrongdoing'},
      {name: 'Nervous', description: 'Feeling apprehensive and on edge'},
      {name: 'Jealous', description: 'Feeling envious of others'},
      {name: 'Homesick', description: 'Feeling longing for familiar surroundings'},
    ],
  },
  {
    id: 'awful',
    label: 'Awful',
    emoji: '\u{1F622}', // crying face
    color: '#D0021B',
    moods: [
      {name: 'Angry', description: 'Feeling strong displeasure or hostility'},
      {name: 'Overwhelmed', description: 'Feeling buried under too much to handle'},
      {name: 'Hopeless', description: 'Feeling that nothing will improve'},
      {name: 'Panicked', description: 'Feeling sudden uncontrollable fear or anxiety'},
      {name: 'Drained', description: 'Feeling completely depleted of energy'},
      {name: 'Depressed', description: 'Feeling persistently low and without energy'},
      {name: 'Enraged', description: 'Feeling extremely angry and out of control'},
      {name: 'Defeated', description: 'Feeling beaten and unable to continue'},
      {name: 'Ashamed', description: 'Feeling embarrassed or humiliated'},
      {name: 'Empty', description: 'Feeling a lack of meaning or purpose'},
      {name: 'Heartbroken', description: 'Feeling deep emotional pain from loss'},
      {name: 'Disgusted', description: 'Feeling strong revulsion or disapproval'},
    ],
  },
];

/**
 * Activity name used when logging mood as an activity.
 * This ensures all mood logs are tracked under a single activity
 * and streaks are calculated for it.
 */
export const MOOD_ACTIVITY_NAME = 'Mood Tracking';
