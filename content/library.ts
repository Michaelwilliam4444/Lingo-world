import type { Book, BookPage, RoleplayScenario, Song } from '@/types/content';

/**
 * Library & music. Every sentence is either a curated phrase or a grammar pattern over concepts,
 * so each book and song is automatically available — grammatically correct — in all five languages.
 * All lyrics are original to LingoWorld.
 */

type Pattern = 'this-is' | 'i-see' | 'i-have' | 'give-me' | 'where-is' | 'location' | 'is-adjective' | 'np' | 'word';

const page = (emoji: string, template: Pattern, slots: Record<string, string>): BookPage => ({ emoji, sentence: { template, slots } });
const phrasePage = (emoji: string, phraseId: string): BookPage => ({ emoji, sentence: { phraseId } });
const L = (en: string, ar: string) => ({ en, ar });

export const BOOKS: Book[] = [
  { id: 'book.colours', title: L('Colours Everywhere', 'الألوان في كل مكان'), coverEmoji: '🎨', worldId: 'my-home', topic: 'colors', ageBands: ['little', 'adventurer'], stage: 1, premium: false, status: 'published',
    pages: [
      page('🍎', 'this-is', { noun: 'food.apple', adj: 'colors.red' }),
      page('🍌', 'this-is', { noun: 'food.banana', adj: 'colors.yellow' }),
      page('🚗', 'this-is', { noun: 'transport.car', adj: 'colors.blue' }),
      page('🌳', 'this-is', { noun: 'nature.tree', adj: 'colors.green' }),
      page('🌸', 'this-is', { noun: 'nature.flower', adj: 'colors.pink' }),
      page('🐻', 'this-is', { noun: 'animals.bear', adj: 'colors.brown' }),
    ],
    quiz: [{ pageIndex: 0, question: L('What colour was the apple?', 'ما لون التفاحة؟'), answerConceptId: 'colors.red', optionConceptIds: ['colors.red', 'colors.blue', 'colors.green'] }] },
  { id: 'book.family', title: L('My Family', 'عائلتي'), coverEmoji: '👨‍👩‍👧', worldId: 'my-home', topic: 'family', ageBands: ['little', 'adventurer'], stage: 1, premium: false, status: 'published',
    pages: [
      page('👩', 'this-is', { noun: 'family.mother' }), page('👨', 'this-is', { noun: 'family.father' }),
      page('👧', 'this-is', { noun: 'family.sister' }), page('👦', 'this-is', { noun: 'family.brother' }),
      page('👶', 'this-is', { noun: 'family.baby' }), page('👵', 'this-is', { noun: 'family.grandmother' }),
    ],
    quiz: [{ pageIndex: 4, question: L('Who was the smallest?', 'من كان الأصغر؟'), answerConceptId: 'family.baby', optionConceptIds: ['family.baby', 'family.father', 'family.grandmother'] }] },
  { id: 'book.farm', title: L('A Day at the Farm', 'يوم في المزرعة'), coverEmoji: '🐮', worldId: 'animal-forest', topic: 'animals', ageBands: ['little', 'adventurer'], stage: 1, premium: false, status: 'published',
    pages: [
      page('🐮', 'i-see', { noun: 'animals.cow' }), page('🐴', 'i-see', { noun: 'animals.horse' }),
      page('🦆', 'i-see', { noun: 'animals.duck' }), page('🐱', 'i-see', { noun: 'animals.cat' }),
      page('🐶', 'i-see', { noun: 'animals.dog', adj: 'descriptions.big' }),
    ],
    quiz: [{ pageIndex: 2, question: L('Which animal swims in the pond?', 'أي حيوان يسبح في البركة؟'), answerConceptId: 'animals.duck', optionConceptIds: ['animals.duck', 'animals.cow', 'animals.horse'] }] },
  { id: 'book.mimo-day', title: L('Mimo’s Big Day', 'يوم ميمو الكبير'), coverEmoji: '🥚', worldId: 'playground-park', topic: 'toys', ageBands: ['little', 'adventurer', 'hero'], stage: 1, premium: false, status: 'published',
    pages: [
      page('☀️', 'i-see', { noun: 'weather.sun', adj: 'colors.yellow' }), page('⚽', 'i-have', { noun: 'toys.ball', adj: 'colors.red' }),
      page('🪁', 'i-see', { noun: 'toys.kite', adj: 'descriptions.big' }), page('🎈', 'i-have', { noun: 'toys.balloon', adj: 'colors.blue' }),
      page('🌙', 'i-see', { noun: 'nature.moon' }), phrasePage('😴', 'story.good_night_mimo'),
    ],
    quiz: [{ pageIndex: 1, question: L('What did Mimo have?', 'ماذا كان مع ميمو؟'), answerConceptId: 'toys.ball', optionConceptIds: ['toys.ball', 'toys.kite', 'nature.moon'] }] },
  { id: 'book.lunch', title: L('Lunch Box Surprise', 'مفاجأة صندوق الغداء'), coverEmoji: '🍱', worldId: 'supermarket-city', topic: 'food', ageBands: ['little', 'adventurer'], stage: 2, premium: false, status: 'published',
    pages: [
      page('🍎', 'i-have', { noun: 'food.apple' }), page('🍌', 'i-have', { noun: 'food.banana' }),
      page('🥪', 'i-have', { noun: 'restaurant.sandwich' }), page('🍪', 'i-have', { noun: 'food.cookie' }),
      page('🍊', 'i-have', { noun: 'food.orange' }), phrasePage('😋', 'rest.delicious'),
    ],
    quiz: [{ pageIndex: 3, question: L('What was the sweet treat?', 'ما الحلوى؟'), answerConceptId: 'food.cookie', optionConceptIds: ['food.cookie', 'food.apple', 'restaurant.sandwich'] }] },
  { id: 'book.where-cat', title: L('Where Is the Cat?', 'أين القطة؟'), coverEmoji: '🐈', worldId: 'my-home', topic: 'directions', ageBands: ['adventurer', 'hero'], stage: 3, premium: false, status: 'published',
    pages: [
      page('🛏️', 'location', { noun: 'animals.cat', prep: 'directions.under', object: 'home.bed' }),
      page('💺', 'location', { noun: 'animals.cat', prep: 'directions.on', object: 'home.chair' }),
      page('📦', 'location', { noun: 'animals.cat', prep: 'directions.in', object: 'home.box' }),
      page('🐶', 'location', { noun: 'animals.cat', prep: 'directions.next_to', object: 'animals.dog' }),
      page('🚪', 'location', { noun: 'animals.cat', prep: 'directions.behind', object: 'home.door' }),
      page('🐘', 'location', { noun: 'animals.elephant', adj: 'colors.yellow', prep: 'directions.under', object: 'home.bridge' }),
    ],
    quiz: [{ pageIndex: 0, question: L('Where was the cat first?', 'أين كانت القطة أولًا؟'), answerConceptId: 'directions.under', optionConceptIds: ['directions.under', 'directions.on', 'directions.in'] }] },
  { id: 'book.zuzu-clothes', title: L('Zuzu’s Silly Clothes', 'ملابس زوزو المضحكة'), coverEmoji: '🐒', worldId: 'magic-castle', topic: 'clothing', ageBands: ['adventurer', 'hero'], stage: 2, premium: false, status: 'published',
    pages: [
      page('👒', 'is-adjective', { noun: 'clothing.hat', predicate: 'descriptions.big' }),
      page('👟', 'is-adjective', { noun: 'clothing.shoe', predicate: 'descriptions.small' }),
      page('🧣', 'is-adjective', { noun: 'clothing.scarf', predicate: 'descriptions.long' }),
      page('👗', 'is-adjective', { noun: 'clothing.dress', predicate: 'colors.pink' }),
      page('🧦', 'is-adjective', { noun: 'clothing.sock', predicate: 'descriptions.funny' }),
    ],
    quiz: [{ pageIndex: 2, question: L('What was long?', 'ما الذي كان طويلًا؟'), answerConceptId: 'clothing.scarf', optionConceptIds: ['clothing.scarf', 'clothing.hat', 'clothing.shoe'] }] },
  { id: 'book.night-sky', title: L('The Night Sky', 'سماء الليل'), coverEmoji: '🌌', worldId: 'space-world', topic: 'nature', ageBands: ['little', 'adventurer', 'hero'], stage: 2, premium: true, status: 'published',
    pages: [
      page('🌙', 'this-is', { noun: 'nature.moon' }), page('⭐', 'i-see', { noun: 'nature.star', adj: 'colors.golden' }),
      page('🚀', 'this-is', { noun: 'transport.rocket', adj: 'descriptions.fast' }), page('🪐', 'i-see', { noun: 'adventure.planet', adj: 'descriptions.big' }),
      page('🧑‍🚀', 'this-is', { noun: 'adventure.astronaut' }),
    ],
    quiz: [{ pageIndex: 2, question: L('What was fast?', 'ما الذي كان سريعًا؟'), answerConceptId: 'transport.rocket', optionConceptIds: ['transport.rocket', 'nature.moon', 'nature.star'] }] },
  { id: 'book.under-sea', title: L('Under the Sea', 'تحت البحر'), coverEmoji: '🐠', worldId: 'underwater-world', topic: 'adventure', ageBands: ['adventurer', 'hero'], stage: 3, premium: true, status: 'published',
    pages: [
      page('🐟', 'i-see', { noun: 'animals.fish', adj: 'colors.orange' }), page('🐙', 'i-see', { noun: 'adventure.octopus', adj: 'colors.purple' }),
      page('🦀', 'i-see', { noun: 'adventure.crab', adj: 'colors.red' }), page('🐬', 'i-see', { noun: 'animals.dolphin', adj: 'descriptions.fast' }),
      page('🐚', 'location', { noun: 'adventure.shell', prep: 'directions.on', object: 'nature.sand' }),
    ],
    quiz: [{ pageIndex: 1, question: L('Which animal was purple?', 'أي حيوان كان بنفسجيًا؟'), answerConceptId: 'adventure.octopus', optionConceptIds: ['adventure.octopus', 'adventure.crab', 'animals.fish'] }] },
  { id: 'book.give-me', title: L('Give Me That!', 'أعطني ذلك!'), coverEmoji: '🙌', worldId: 'school-town', topic: 'school', ageBands: ['adventurer', 'hero'], stage: 3, premium: false, status: 'published',
    pages: [
      page('📘', 'give-me', { noun: 'school.book', adj: 'colors.blue' }), page('✏️', 'give-me', { noun: 'school.pencil', adj: 'colors.yellow' }),
      page('🎒', 'give-me', { noun: 'school.schoolbag', adj: 'descriptions.big' }), page('📏', 'give-me', { noun: 'school.ruler', adj: 'descriptions.long' }),
      phrasePage('💛', 'greet.yes_please'),
    ],
    quiz: [{ pageIndex: 1, question: L('What colour was the pencil?', 'ما لون القلم؟'), answerConceptId: 'colors.yellow', optionConceptIds: ['colors.yellow', 'colors.blue', 'colors.red'] }] },
  { id: 'book.weather', title: L('Weather Watch', 'مراقبة الطقس'), coverEmoji: '🌦️', worldId: 'beach-island', topic: 'weather', ageBands: ['little', 'adventurer', 'hero'], stage: 2, premium: false, status: 'published',
    pages: [phrasePage('☀️', 'weather.sunny'), phrasePage('🌧️', 'weather.raining'), phrasePage('❄️', 'weather.snowing'), phrasePage('🥶', 'weather.cold'), phrasePage('🥵', 'weather.hot')],
    quiz: [{ pageIndex: 2, question: L('What falls in winter?', 'ماذا يسقط في الشتاء؟'), answerConceptId: 'weather.snow', optionConceptIds: ['weather.snow', 'weather.sun', 'weather.rainbow'] }] },
  { id: 'book.golden-key', title: L('The Golden Key', 'المفتاح الذهبي'), coverEmoji: '🗝️', worldId: 'magic-castle', topic: 'adventure', ageBands: ['adventurer', 'hero'], stage: 3, premium: false, status: 'published',
    pages: [
      phrasePage('✨', 'story.golden_key'),
      page('🗝️', 'location', { noun: 'home.key', adj: 'colors.golden', prep: 'directions.in', object: 'home.garden' }),
      page('🐶', 'i-see', { noun: 'animals.puppy', adj: 'descriptions.small' }),
      page('🐚', 'this-is', { noun: 'adventure.shell', adj: 'descriptions.magic' }),
      page('🏰', 'i-see', { noun: 'adventure.castle', adj: 'descriptions.big' }),
      page('🚪', 'where-is', { noun: 'home.door', adj: 'colors.golden' }),
      phrasePage('🎉', 'story.found_it'),
    ],
    quiz: [{ pageIndex: 2, question: L('Who did we help?', 'من ساعدنا؟'), answerConceptId: 'animals.puppy', optionConceptIds: ['animals.puppy', 'animals.cat', 'adventure.dragon'] }] },
];

const line = (template: Pattern, slots: Record<string, string>) => ({ template, slots });

export const SONGS: Song[] = [
  { id: 'song.hello', title: L('The Hello Song', 'أغنية مرحبًا'), emoji: '👋', kind: 'song', topic: 'greetings', bpm: 96, premium: false,
    lines: [{ phraseId: 'story.hello_friend' }, { phraseId: 'greet.how_are_you' }, { phraseId: 'greet.im_fine' }, { phraseId: 'greet.lets_go' }] },
  { id: 'song.colours', title: L('Rainbow Chant', 'نشيد قوس قزح'), emoji: '🌈', kind: 'chant', topic: 'colors', bpm: 104, premium: false,
    lines: ['colors.red', 'colors.yellow', 'colors.green', 'colors.blue', 'colors.purple', 'colors.pink'].map((c) => line('word', { noun: c })) },
  { id: 'song.counting', title: L('Count with Bibi', 'عُدّ مع بيبي'), emoji: '🔢', kind: 'chant', topic: 'numbers', bpm: 100, premium: false,
    lines: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].map((n) => line('word', { noun: `numbers.${n}` })) },
  { id: 'song.animals', title: L('Animal Parade', 'استعراض الحيوانات'), emoji: '🐘', kind: 'song', topic: 'animals', bpm: 92, premium: false,
    lines: [line('i-see', { noun: 'animals.elephant', adj: 'descriptions.big' }), line('i-see', { noun: 'animals.mouse', adj: 'descriptions.small' }),
      line('i-see', { noun: 'animals.lion' }), line('i-see', { noun: 'animals.monkey', adj: 'descriptions.funny' })] },
  { id: 'song.body', title: L('Head and Hands', 'الرأس واليدان'), emoji: '🙌', kind: 'rhyme', topic: 'body', bpm: 110, premium: false,
    lines: ['body.head', 'body.eye', 'body.nose', 'body.mouth', 'body.hand', 'body.foot'].map((c) => line('word', { noun: c })) },
  { id: 'song.mimo-dance', title: L('Mimo’s Dance', 'رقصة ميمو'), emoji: '💃', kind: 'song', topic: 'actions', bpm: 120, premium: false,
    lines: ['actions.jump', 'actions.dance', 'actions.spin', 'actions.clap', 'actions.sit'].map((c) => line('word', { noun: c })) },
  { id: 'song.weather', title: L('Sun and Rain', 'شمس ومطر'), emoji: '🌦️', kind: 'song', topic: 'weather', bpm: 98, premium: false,
    lines: [{ phraseId: 'weather.sunny' }, { phraseId: 'weather.raining' }, { phraseId: 'weather.cold' }, { phraseId: 'weather.hot' }] },
  { id: 'song.days', title: L('Days of the Week', 'أيام الأسبوع'), emoji: '📅', kind: 'chant', topic: 'calendar', bpm: 104, premium: true,
    lines: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => line('word', { noun: `calendar.${d}` })) },
  { id: 'song.phonics-sounds', title: L('Sound Detectives', 'محققو الأصوات'), emoji: '🔤', kind: 'phonics', topic: 'animals', bpm: 90, premium: false,
    lines: ['animals.cat', 'animals.dog', 'animals.duck', 'animals.bird', 'animals.bear'].map((c) => line('word', { noun: c })) },
];

const rp = (id: string, en: string, ar: string, emoji: string, topic: RoleplayScenario['topic'], partner: RoleplayScenario['partner'], minStage: RoleplayScenario['minStage'],
  turns: [string, string[]][]): RoleplayScenario => ({ id, title: L(en, ar), emoji, topic, partner, minStage, turns: turns.map(([p, r]) => ({ partnerPhraseId: p, replyPhraseIds: r })) });

export const ROLEPLAYS: RoleplayScenario[] = [
  rp('rp.new-friend', 'Meeting a New Friend', 'لقاء صديق جديد', '🤝', 'greetings', 'lumi', 1, [
    ['greet.whats_your_name', ['greet.my_name_is']], ['greet.how_are_you', ['greet.im_fine', 'feel.i_feel_good']], ['friends.want_to_play', ['friends.lets_play']]]),
  rp('rp.playground', 'At the Playground', 'في الملعب', '🛝', 'hobbies', 'zuzu', 2, [
    ['friends.want_to_play', ['friends.lets_play']], ['story.be_careful', ['greet.im_fine']], ['q.do_you_like_it', ['q.i_like_it']]]),
  rp('rp.shop', 'At the Shop', 'في المتجر', '🛍️', 'shopping', 'bibi', 3, [
    ['rest.what_would_you_like', ['shop.i_would_like']], ['shop.here_you_are', ['shop.how_much']], ['greet.well_done', ['shop.thanks_bye']]]),
  rp('rp.restaurant', 'At the Restaurant', 'في المطعم', '🍽️', 'restaurant', 'pico', 3, [
    ['greet.how_are_you', ['rest.table_please']], ['rest.what_would_you_like', ['rest.water_please', 'shop.i_would_like']],
    ['q.do_you_like_it', ['rest.delicious', 'q.i_like_it']], ['shop.here_you_are', ['rest.the_bill']]]),
  rp('rp.doctor', 'At the Doctor', 'عند الطبيب', '🩺', 'body', 'pico', 4, [
    ['greet.how_are_you', ['doctor.head_hurts']], ['greet.help_me', ['greet.yes_please']], ['greet.well_done', ['doctor.feel_better']]]),
  rp('rp.school', 'In Class', 'في الفصل', '🏫', 'school', 'pico', 3, [
    ['q.what_is_this', ['school.dont_understand', 'school.repeat_please']], ['greet.whats_your_name', ['greet.my_name_is']], ['greet.well_done', ['greet.yes_please']]]),
  rp('rp.birthday', 'Birthday Party', 'حفلة عيد ميلاد', '🎂', 'calendar', 'bibi', 2, [
    ['party.happy_birthday', ['greet.yes_please']], ['q.do_you_like_it', ['q.i_like_it']], ['friends.want_to_play', ['friends.lets_play']]]),
  rp('rp.airport', 'At the Airport', 'في المطار', '🛫', 'travel', 'nova', 4, [
    ['travel.where_are_we_going', ['travel.take_the_plane']], ['greet.help_me', ['travel.my_ticket']], ['greet.lets_go', ['greet.see_you_tomorrow']]]),
  rp('rp.hotel', 'At the Hotel', 'في الفندق', '🏨', 'travel', 'lumi', 4, [
    ['greet.how_are_you', ['greet.im_fine']], ['greet.whats_your_name', ['greet.my_name_is']], ['q.where_is_it', ['dir.go_left', 'dir.go_right']]]),
];
