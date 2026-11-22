/**
 * Character pixel templates (16×24). Each character is assembled from a head
 * (rows 0-12), a body (rows 13-19) and legs (rows 20-23), so a handful of
 * templates covers every direction, walk frame and hair style.
 *
 * Palette keys:
 *   k outline   e eyes      c blush
 *   h hair      H hair shade
 *   s skin      S skin shade
 *   t shirt     T shirt shade
 *   p pants     b shoes
 *   a cap       A cap shade (player only)
 */

export type Dir = 'down' | 'up' | 'side'

export interface HeadSet {
  down: readonly string[]
  up: readonly string[]
  side: readonly string[]
}

/** Extra rows painted after the body, e.g. long hair over the shoulders. */
export type Overlay = ReadonlyArray<readonly [row: number, pixels: string]>

export const HEADS: readonly HeadSet[] = [
  // 0 — short hair
  {
    down: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khsssssssshk..',
      '..kssssssssssk..',
      '..kssessssessk..',
      '..kssessssessk..',
      '..kscsssssscsk..',
      '...kSssssssSk...'
    ],
    up: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..kHhhhhhhhhHk..',
      '..kHHhhhhhhHHk..',
      '...kSHHHHHHSk...'
    ],
    side: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..kssshhhhhhhk..',
      '..kssssshhhhhk..',
      '..ksesssshhhhk..',
      '..ksesssshhhhk..',
      '..kscssshhhHHk..',
      '...kSssssHHHk...'
    ]
  },
  // 1 — long hair
  {
    down: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khsssssssshk..',
      '..khsssssssshk..',
      '..khsesssseshk..',
      '..khsesssseshk..',
      '..khcsssssschk..',
      '..khSssssssShk..'
    ],
    up: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..'
    ],
    side: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..kssshhhhhhhk..',
      '..kssssshhhhhk..',
      '..ksesssshhhhk..',
      '..ksesssshhhhk..',
      '..kscssshhhhhk..',
      '...kSssshhhhhk..'
    ]
  },
  // 2 — big curly hair
  {
    down: [
      '.....kkkkkk.....',
      '...kkhhhhhhkk...',
      '..khhhhhhhhhhk..',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhsssssssshhk.',
      '.khsssssssssshk.',
      '.khssessssesshk.',
      '.khssessssesshk.',
      '.khscsssssscshk.',
      '..khSssssssShk..'
    ],
    up: [
      '.....kkkkkk.....',
      '...kkhhhhhhkk...',
      '..khhhhhhhhhhk..',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.kHhhhhhhhhhhHk.',
      '..kHhhhhhhhhHk..',
      '...kHHHHHHHHk...'
    ],
    side: [
      '.....kkkkkk.....',
      '...kkhhhhhhkk...',
      '..khhhhhhhhhhk..',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.kssshhhhhhhhhk.',
      '.kssssshhhhhhhk.',
      '.ksesssshhhhhhk.',
      '.ksesssshhhhhhk.',
      '.kscssshhhhhHk..',
      '..kSssHHHHHHk...'
    ]
  },
  // 3 — cap (the player)
  {
    down: [
      '................',
      '.....kkkkkk.....',
      '....kaaaaaak....',
      '...kaaaaaaaak...',
      '..kaaaaaaaaaak..',
      '..kaaaaaaaaaak..',
      '.kAAAAAAAAAAAAk.',
      '..khsssssssshk..',
      '..kssssssssssk..',
      '..kssessssessk..',
      '..kssessssessk..',
      '..kscsssssscsk..',
      '...kSssssssSk...'
    ],
    up: [
      '................',
      '.....kkkkkk.....',
      '....kaaaaaak....',
      '...kaaaaaaaak...',
      '..kaaaaaaaaaak..',
      '..kaaaaaaaaaak..',
      '..kAaaaaaaaaAk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..kHhhhhhhhhHk..',
      '..kHHhhhhhhHHk..',
      '...kSHHHHHHSk...'
    ],
    side: [
      '................',
      '.....kkkkkk.....',
      '....kaaaaaak....',
      '...kaaaaaaaak...',
      '..kaaaaaaaaaak..',
      '..kaaaaaaaaaak..',
      'kAAAAAaaaaaaak..',
      '..kssshhhhhhhk..',
      '..kssssshhhhhk..',
      '..ksesssshhhhk..',
      '..ksesssshhhhk..',
      '..kscssshhhHHk..',
      '...kSssssHHHk...'
    ]
  }
]

/** Hair that falls past the head, per style and direction. */
export const HAIR_OVERLAYS: ReadonlyArray<Partial<Record<Dir, Overlay>>> = [
  {},
  {
    down: [
      [13, '..khk......khk..'],
      [14, '..khk......khk..'],
      [15, '..kHk......kHk..'],
      [16, '...k........k...']
    ],
    up: [
      [13, '..khhhhhhhhhhk..'],
      [14, '..kHhhhhhhhhHk..'],
      [15, '...kHHHHHHHHk...']
    ],
    side: [
      [13, '.........hhhk...'],
      [14, '.........hhhk...'],
      [15, '.........HHHk...'],
      [16, '..........kk....']
    ]
  },
  {},
  {}
]

export const BODIES: Record<Dir, readonly string[]> = {
  down: [
    '....ktSSSStk....',
    '...kttttttttk...',
    '..kTttttttttTk..',
    '..kTttttttttTk..',
    '..ksttttttttsk..',
    '...kppppppppk...',
    '...kppppppppk...'
  ],
  up: [
    '....kttttttk....',
    '...kttttttttk...',
    '..kTttttttttTk..',
    '..kTttttttttTk..',
    '..ksttttttttsk..',
    '...kppppppppk...',
    '...kppppppppk...'
  ],
  side: [
    '.....ktSStk.....',
    '....kttttttk....',
    '....kttTtttk....',
    '....kttTtttk....',
    '....kttstttk....',
    '....kppppppk....',
    '....kppppppk....'
  ]
}

/** Seen from behind while typing: elbows move alternately. */
export const TYPING_BODIES: readonly (readonly string[])[] = [
  [
    '....kttttttk....',
    '..kTttttttttk...',
    '..kTttttttttTk..',
    '...kttttttttTk..',
    '...kttttttttk...',
    '...kppppppppk...',
    '...kppppppppk...'
  ],
  [
    '....kttttttk....',
    '...kttttttttTk..',
    '..kTttttttttTk..',
    '..kTttttttttk...',
    '...kttttttttk...',
    '...kppppppppk...',
    '...kppppppppk...'
  ]
]

/** Slumped over the desk, arms resting forward. */
export const SLEEP_BODY: readonly string[] = [
  '....kttttttk....',
  '..kTttttttttTk..',
  '..kTttttttttTk..',
  '...kttttttttk...',
  '...kttttttttk...',
  '...kppppppppk...',
  '...kppppppppk...'
]

export const LEGS = {
  frontIdle: ['...kpppkkpppk...', '...kpppkkpppk...', '...kbbbkkbbbk...', '....kkk..kkk....'],
  frontStepA: ['...kpppkkpppk...', '...kpppkkbbbk...', '...kbbbk.kkk....', '....kkk.........'],
  frontStepB: ['...kpppkkpppk...', '...kbbbkkpppk...', '....kkk.kbbbk...', '.........kkk....'],
  sideIdle: ['....kppppppk....', '....kppppppk....', '...kbbbbbbbk....', '...kkkkkkkkk....'],
  sideStride: ['....kppppppk....', '...kpppkkpppk...', '..kbbbk..kbbbk..', '..kkkkk..kkkkk..']
} as const

export const CHAR_W = 16
export const CHAR_H = 24

/** Frame order inside every character sheet. */
export const CHAR_FRAMES = [
  'down-0',
  'down-1',
  'down-2',
  'up-0',
  'up-1',
  'up-2',
  'side-0',
  'side-1',
  'type-0',
  'type-1',
  'sleep-0',
  'sleep-1'
] as const

export type CharFrame = (typeof CHAR_FRAMES)[number]
