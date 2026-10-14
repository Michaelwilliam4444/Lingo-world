import type { ActivityFamily, CharacterId, StageNumber } from '@/types/core';
import type { Episode, NarrativeLine, StoryArc, StoryBeat, TopicId } from '@/types/content';

/**
 * Story content. Episodes are authored with a reusable 6-beat template:
 *   intro → discovery (target-language focus line) → speak → activity → [choice] → activity → finale → cliffhanger
 * The journey engine fills slots (focus1/focus2) with the child's due/new vocabulary each day,
 * so replaying an episode never produces the same words, games or sentences.
 *
 * Narrative text is authored in English with Arabic translations; other interface locales go
 * through the CMS translation workflow (falls back to English until reviewed).
 */

type T = [en: string, ar: string];
type Emotion = NarrativeLine['emotion'];

const ln = (speaker: CharacterId | 'narrator', text: T, emotion?: Emotion, target?: NarrativeLine['target']): NarrativeLine => ({
  speaker, text: { en: text[0], ar: text[1] }, emotion, target,
});
const focus = (slot = 'focus1', pattern: 'this-is' | 'i-see' | 'np' | 'word' | 'where-is' | 'give-me' = 'this-is') => ({ slot, pattern });

interface EpisodeSpec {
  id: string;
  arc: string;
  order: number;
  world: string;
  minStage: StageNumber;
  topics: TopicId[];
  title: T;
  summary: T;
  intro: NarrativeLine[];
  discover: NarrativeLine;
  speak: T;
  activity1: { families: ActivityFamily[]; purpose: T };
  choice?: { key: string; prompt: T; options: { id: string; label: T; emoji: string }[]; after?: NarrativeLine[] };
  activity2?: { families: ActivityFamily[]; purpose: T };
  finale: NarrativeLine[];
  cliffhanger?: NarrativeLine[];
  rewards: string[];
  callbacks?: { choiceKey: string; optionId: string; line: NarrativeLine }[];
  memory?: string;
}

function episode(s: EpisodeSpec): Episode {
  const beats: StoryBeat[] = [
    { id: `${s.id}.intro`, background: s.world, lines: s.intro, memoryCallbacks: s.callbacks },
    { id: `${s.id}.discover`, background: s.world, lines: [s.discover],
      interaction: { kind: 'speak', prompt: { en: s.speak[0], ar: s.speak[1] }, expect: { slot: 'focus1' } } },
    { id: `${s.id}.act1`, background: s.world, lines: [],
      interaction: { kind: 'activity', families: s.activity1.families, purpose: { en: s.activity1.purpose[0], ar: s.activity1.purpose[1] } } },
  ];
  if (s.choice) {
    beats.push({
      id: `${s.id}.choice`, background: s.world, lines: s.choice.after ?? [],
      interaction: {
        kind: 'choice', choiceKey: s.choice.key, prompt: { en: s.choice.prompt[0], ar: s.choice.prompt[1] },
        options: s.choice.options.map((o) => ({ id: o.id, emoji: o.emoji, label: { en: o.label[0], ar: o.label[1] } })),
      },
    });
  }
  if (s.activity2) {
    beats.push({ id: `${s.id}.act2`, background: s.world, lines: [],
      interaction: { kind: 'activity', families: s.activity2.families, purpose: { en: s.activity2.purpose[0], ar: s.activity2.purpose[1] } } });
  }
  beats.push({ id: `${s.id}.finale`, background: s.world, lines: s.finale });
  return {
    id: s.id, arcId: s.arc, order: s.order, worldId: s.world,
    title: { en: s.title[0], ar: s.title[1] }, summary: { en: s.summary[0], ar: s.summary[1] },
    topics: s.topics, beats, cliffhanger: s.cliffhanger, rewardIds: s.rewards, minStage: s.minStage, memoryKey: s.memory,
    status: 'published', version: 1,
  };
}

/* ═══════════════════════ SEASON 1 · THE GOLDEN KEY ═══════════════════════ */

const GK: EpisodeSpec[] = [
  {
    id: 'gk-01', arc: 'golden-key', order: 1, world: 'my-home', minStage: 1, topics: ['greetings', 'colors', 'home'],
    title: ['The Key from the Sky', 'المفتاح الذي سقط من السماء'],
    summary: ['A golden key falls into the garden — and Mimo’s egg starts to glow.', 'مفتاح ذهبي يسقط في الحديقة، وبيضة ميمو تبدأ بالتوهج.'],
    intro: [
      ln('lumi', ['Hello, {name}! I’m Lumi. I’m so happy you’re here!', 'مرحبًا يا {name}! أنا لومي. أنا سعيدة جدًا بوجودك!'], 'happy', { phraseId: 'story.hello_friend' }),
      ln('narrator', ['Suddenly… something shiny falls from the sky! CLINK!', 'فجأة… شيء لامع يسقط من السماء! طَنْ!'], 'surprised'),
      ln('lumi', ['Look! A golden key!', 'انظر! مفتاح ذهبي!'], 'excited', { phraseId: 'story.golden_key' }),
    ],
    discover: ln('pico', ['Hoo-hoo! Every adventure needs words. Here is our first one.', 'هوو هوو! كل مغامرة تحتاج كلمات. هذه أول كلمة لنا.'], 'thinking', focus()),
    speak: ['Say it with me!', 'قلها معي!'],
    activity1: { families: ['listening', 'matching'], purpose: ['Help Lumi find things that match the key’s glow.', 'ساعد لومي في إيجاد أشياء تتوهج مثل المفتاح.'] },
    choice: { key: 'gk.first-search', prompt: ['Where should we look first?', 'أين نبحث أولًا؟'],
      options: [{ id: 'kitchen', emoji: '🍳', label: ['The kitchen', 'المطبخ'] }, { id: 'garden', emoji: '🌻', label: ['The garden', 'الحديقة'] }] },
    activity2: { families: ['speaking', 'movement'], purpose: ['Wake Mimo’s egg with your voice!', 'أيقظ بيضة ميمو بصوتك!'] },
    finale: [
      ln('mimo', ['*crack… crack…* The egg wiggles when you speak!', '*طق… طق…* البيضة تتحرك عندما تتكلم!'], 'excited'),
      ln('lumi', ['The key has a tiny picture of a door on it. Which door does it open?', 'على المفتاح صورة صغيرة لباب. أي باب يفتح؟'], 'thinking'),
    ],
    cliffhanger: [ln('narrator', ['That night, the key glows… and points towards the window.', 'في تلك الليلة، يتوهج المفتاح… ويشير نحو النافذة.'], 'surprised'), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.key'], memory: 'found-golden-key',
  },
  {
    id: 'gk-02', arc: 'golden-key', order: 2, world: 'my-home', minStage: 1, topics: ['home', 'family', 'colors'],
    title: ['Who Dropped the Key?', 'من أسقط المفتاح؟'],
    summary: ['Lumi and Zuzu search the house for clues.', 'لومي وزوزو يبحثان في البيت عن أدلة.'],
    intro: [
      ln('zuzu', ['Hi hi hi! I’m Zuzu! I found a clue! It’s a… banana!', 'مرحبا مرحبا! أنا زوزو! وجدت دليلًا! إنه… موزة!'], 'silly'),
      ln('lumi', ['Zuzu, that’s your lunch! Let’s look properly.', 'زوزو، هذا غداؤك! لنبحث جيدًا.'], 'happy'),
    ],
    callbacks: [
      { choiceKey: 'gk.first-search', optionId: 'kitchen', line: ln('lumi', ['Yesterday we started in the kitchen — let’s try upstairs now!', 'بالأمس بدأنا من المطبخ، لنجرب الطابق العلوي الآن!']) },
      { choiceKey: 'gk.first-search', optionId: 'garden', line: ln('lumi', ['Yesterday you picked the garden. The key landed right there!', 'بالأمس اخترت الحديقة. المفتاح سقط هناك بالضبط!']) },
    ],
    discover: ln('pico', ['A clue is hiding in this word!', 'هناك دليل مختبئ في هذه الكلمة!'], 'thinking', focus()),
    speak: ['Tell Zuzu the word!', 'قل الكلمة لزوزو!'],
    activity1: { families: ['puzzle', 'listening'], purpose: ['Search the rooms for hidden clues.', 'ابحث في الغرف عن أدلة مخفية.'] },
    activity2: { families: ['memory', 'matching'], purpose: ['Match the clues to make a picture.', 'طابق الأدلة لتكوين صورة.'] },
    finale: [
      ln('nova', ['I’m Nova. I solve mysteries. These clues are footprints… leading to the park!', 'أنا نوفا. أحل الألغاز. هذه الأدلة آثار أقدام… تقود إلى الحديقة العامة!'], 'thinking'),
    ],
    cliffhanger: [ln('narrator', ['Something giggles behind the slide…', 'شيء ما يضحك خلف الزحليقة…'], 'surprised'), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.footprint', 'furniture.lamp'],
  },
  {
    id: 'gk-03', arc: 'golden-key', order: 3, world: 'playground-park', minStage: 1, topics: ['toys', 'actions', 'numbers'],
    title: ['Footprints in the Park', 'آثار في الحديقة'],
    summary: ['The footprints lead through the playground. Who made them?', 'الآثار تقود عبر الملعب. من صنعها؟'],
    intro: [
      ln('lumi', ['Look at all these footprints! Let’s count them.', 'انظر إلى كل هذه الآثار! لنعدّها.'], 'excited', { phraseId: 'story.look' }),
      ln('zuzu', ['One, two, banana!', 'واحد، اثنان، موزة!'], 'silly'),
      ln('lumi', ['Haha! Not banana, Zuzu. Let’s help him!', 'ههه! ليست موزة يا زوزو. لنساعده!'], 'happy'),
    ],
    discover: ln('pico', ['The footprints stop next to this!', 'الآثار تتوقف بجانب هذا!'], 'surprised', focus()),
    speak: ['Say the word to follow the trail!', 'قل الكلمة لتتبع الأثر!'],
    activity1: { families: ['movement', 'listening'], purpose: ['Run along the trail and catch the right words!', 'اركض على الأثر والتقط الكلمات الصحيحة!'] },
    choice: { key: 'gk.footprints', prompt: ['Two trails! Which footprints do we follow?', 'أثران! أي آثار نتبع؟'],
      options: [{ id: 'big', emoji: '🐾', label: ['The big ones', 'الكبيرة'] }, { id: 'small', emoji: '🐁', label: ['The small ones', 'الصغيرة'] }] },
    activity2: { families: ['speaking', 'movement'], purpose: ['Tell Mimo what to do so you can climb up!', 'قل لميمو ماذا يفعل لتتمكن من الصعود!'] },
    finale: [
      ln('bibi', ['Tweet-tweet! I’m Bibi! I saw who made the footprints — it was a teacher in a hurry!', 'تويت تويت! أنا بيبي! رأيت من صنع الآثار — كانت معلمة مستعجلة!'], 'excited'),
    ],
    cliffhanger: [ln('narrator', ['A school bell rings far away… DING DONG!', 'جرس مدرسة يرن من بعيد… دينغ دونغ!']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.music', 'clothing.cap'],
  },
  {
    id: 'gk-04', arc: 'golden-key', order: 4, world: 'school-town', minStage: 1, topics: ['school', 'colors', 'numbers'],
    title: ['Professor Pico’s Clue', 'دليل البروفيسور بيكو'],
    summary: ['At School Town, Pico finds a drawing of the key’s door.', 'في مدينة المدرسة، يجد بيكو رسمة لباب المفتاح.'],
    intro: [
      ln('pico', ['Welcome to my classroom! I found something in an old book.', 'أهلًا بكم في فصلي! وجدت شيئًا في كتاب قديم.'], 'thinking'),
      ln('pico', ['It’s a drawing of a golden door… but some colours are missing!', 'إنها رسمة لباب ذهبي… لكن بعض الألوان ناقصة!'], 'worried'),
    ],
    callbacks: [
      { choiceKey: 'gk.footprints', optionId: 'big', line: ln('nova', ['The big footprints led us here. Good choice, detective!', 'الآثار الكبيرة قادتنا إلى هنا. اختيار رائع أيها المحقق!']) },
      { choiceKey: 'gk.footprints', optionId: 'small', line: ln('nova', ['The little footprints were a mouse! But it showed us the way here.', 'الآثار الصغيرة كانت لفأر! لكنه دلّنا على الطريق إلى هنا.']) },
    ],
    discover: ln('pico', ['First, a new word for our notebook.', 'أولًا، كلمة جديدة لدفترنا.'], 'happy', focus()),
    speak: ['Say it for the class!', 'قلها للفصل!'],
    activity1: { families: ['puzzle', 'matching'], purpose: ['Colour the missing parts of the door.', 'لوّن الأجزاء الناقصة من الباب.'] },
    activity2: { families: ['listening', 'memory'], purpose: ['Remember the order of the colours.', 'تذكّر ترتيب الألوان.'] },
    finale: [
      ln('pico', ['The book says: “The golden door hides behind a hundred doors…”', 'الكتاب يقول: «الباب الذهبي مختبئ خلف مئة باب…»'], 'surprised'),
      ln('zuzu', ['A hundred doors? That’s a lot of knocking!', 'مئة باب؟ هذا طرق كثير!'], 'silly'),
    ],
    cliffhanger: [ln('narrator', ['Zuzu’s tummy rumbles… and the key smells of cookies?', 'بطن زوزو يقرقر… والمفتاح رائحته كالكعك؟']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.owl', 'furniture.bookshelf'],
  },
  {
    id: 'gk-05', arc: 'golden-key', order: 5, world: 'supermarket-city', minStage: 1, topics: ['food', 'numbers', 'shopping'],
    title: ['The Key-Shaped Cookie', 'الكعكة على شكل مفتاح'],
    summary: ['A baker in Supermarket City made cookies shaped like the key!', 'خبّاز في مدينة السوبرماركت صنع كعكًا على شكل المفتاح!'],
    intro: [
      ln('zuzu', ['Mmm, Supermarket City! I’ll buy ten bananas and one key!', 'ممم، مدينة السوبرماركت! سأشتري عشر موزات ومفتاحًا!'], 'silly'),
      ln('lumi', ['Look, Zuzu — that cookie has the same shape as our key!', 'انظر يا زوزو، تلك الكعكة لها نفس شكل مفتاحنا!'], 'surprised'),
    ],
    discover: ln('pico', ['To talk to the baker, we need this word.', 'لنتحدث مع الخبّاز، نحتاج هذه الكلمة.'], 'thinking', focus()),
    speak: ['Ask the baker!', 'اسأل الخبّاز!'],
    activity1: { families: ['roleplay', 'listening'], purpose: ['Shop for the baker’s ingredients.', 'تسوّق مكونات الخبّاز.'] },
    activity2: { families: ['movement', 'matching'], purpose: ['Cook the recipe together!', 'اطبخوا الوصفة معًا!'] },
    finale: [
      ln('nova', ['The baker says a forest owl gave her the recipe. The owl knows about the door!', 'الخبّازة تقول إن بومة من الغابة أعطتها الوصفة. البومة تعرف عن الباب!'], 'thinking'),
    ],
    cliffhanger: [ln('narrator', ['Deep in the forest, two big eyes open in the dark…', 'في عمق الغابة، تنفتح عينان كبيرتان في الظلام…']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.cookie'],
  },
  {
    id: 'gk-06', arc: 'golden-key', order: 6, world: 'animal-forest', minStage: 1, topics: ['animals', 'nature'],
    title: ['The Owl Who Saw Everything', 'البومة التي رأت كل شيء'],
    summary: ['A wise owl will help — if you can answer her animal riddles.', 'بومة حكيمة ستساعد إن استطعت حل ألغاز الحيوانات.'],
    intro: [
      ln('narrator', ['The forest is full of sounds. Rustle… tweet… splash!', 'الغابة مليئة بالأصوات. حفيف… تغريد… رشرشة!']),
      ln('pico', ['That’s my cousin, the old owl! She loves riddles.', 'هذه قريبتي البومة العجوز! إنها تحب الألغاز.'], 'happy'),
    ],
    discover: ln('pico', ['Her first riddle is about this animal.', 'لغزها الأول عن هذا الحيوان.'], 'thinking', focus()),
    speak: ['Answer the owl!', 'أجب البومة!'],
    activity1: { families: ['listening', 'puzzle'], purpose: ['Listen to the animal riddles.', 'استمع إلى ألغاز الحيوانات.'] },
    activity2: { families: ['music', 'memory'], purpose: ['Repeat the forest song in the right order.', 'كرّر أغنية الغابة بالترتيب الصحيح.'] },
    finale: [
      ln('pico', ['The owl says: “The golden door is in a castle. But first, find the lost puppy — he has a map!”', 'البومة تقول: «الباب الذهبي في قلعة. لكن أولًا، جدوا الجرو الضائع، معه خريطة!»'], 'surprised'),
    ],
    cliffhanger: [ln('narrator', ['Woof… woof… a tiny, sad bark comes from the river.', 'هاو… هاو… نباح صغير وحزين يأتي من النهر.'], 'worried'), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.owl', 'item.lantern'],
  },
  {
    id: 'gk-07', arc: 'golden-key', order: 7, world: 'animal-forest', minStage: 1, topics: ['animals', 'descriptions', 'colors'],
    title: ['The Lost Puppy', 'الجرو الضائع'],
    summary: ['A puppy is lost by the river. Can you help him get home?', 'جرو ضائع عند النهر. هل يمكنك مساعدته على العودة؟'],
    intro: [
      ln('lumi', ['Oh! A little puppy! He’s scared. Let’s help him.', 'أوه! جرو صغير! إنه خائف. لنساعده.'], 'worried'),
      ln('nova', ['He has something on his collar… a piece of a map!', 'هناك شيء في طوقه… قطعة من خريطة!'], 'surprised'),
    ],
    discover: ln('lumi', ['The puppy keeps looking at this. Say it to cheer him up!', 'الجرو ينظر إلى هذا باستمرار. قله لتفرحه!'], 'happy', focus()),
    speak: ['Talk to the puppy!', 'تحدث إلى الجرو!'],
    activity1: { families: ['speaking', 'movement'], purpose: ['Guide the puppy across the stones.', 'وجّه الجرو عبر الحجارة.'] },
    choice: { key: 'gk.puppy', prompt: ['How do we help the puppy home?', 'كيف نساعد الجرو للعودة؟'],
      options: [{ id: 'carry', emoji: '🤗', label: ['Carry him', 'نحمله'] }, { id: 'call', emoji: '📣', label: ['Call his family', 'ننادي عائلته'] }],
      after: [ln('narrator', ['The puppy wags his tail. His family comes running!', 'الجرو يهز ذيله. عائلته تأتي راكضة!'], 'happy')] },
    activity2: { families: ['matching', 'listening'], purpose: ['Find the puppy’s family by their description.', 'جد عائلة الجرو من وصفها.'] },
    finale: [
      ln('lumi', ['You did it, {name}! The puppy is home. And look — he gave us the map piece!', 'لقد فعلتها يا {name}! الجرو في بيته. وانظر، أعطانا قطعة الخريطة!'], 'excited'),
      ln('nova', ['The map shows… a beach with a lighthouse.', 'الخريطة تظهر… شاطئًا عليه منارة.'], 'thinking'),
    ],
    cliffhanger: [ln('narrator', ['Far away, a seashell starts to sing…', 'بعيدًا، تبدأ صدفة بالغناء…']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.puppy', 'item.map'], memory: 'helped-puppy',
  },
  {
    id: 'gk-08', arc: 'golden-key', order: 8, world: 'beach-island', minStage: 2, topics: ['nature', 'weather', 'clothing'],
    title: ['Message in a Shell', 'رسالة في صدفة'],
    summary: ['A singing shell holds the next clue — but a storm is coming.', 'صدفة مغنية تحمل الدليل التالي، لكن عاصفة قادمة.'],
    intro: [
      ln('bibi', ['Listen! The shell is singing a song!', 'اسمعوا! الصدفة تغني أغنية!'], 'excited'),
      ln('zuzu', ['It’s singing about… sandwiches?', 'إنها تغني عن… السندويتشات؟'], 'silly'),
      ln('bibi', ['No, Zuzu — it’s singing about the weather!', 'لا يا زوزو، إنها تغني عن الطقس!'], 'happy'),
    ],
    callbacks: [{ choiceKey: 'gk.puppy', optionId: '*', line: ln('lumi', ['Remember the puppy? His map brought us all the way here!', 'تذكر الجرو؟ خريطته أوصلتنا إلى هنا!'], 'happy') }],
    discover: ln('pico', ['The shell’s song has this word in it.', 'أغنية الصدفة فيها هذه الكلمة.'], 'thinking', focus()),
    speak: ['Sing it back to the shell!', 'غنّها للصدفة!'],
    activity1: { families: ['music', 'listening'], purpose: ['Clap the rhythm of the shell’s song.', 'صفّق على إيقاع أغنية الصدفة.'] },
    choice: { key: 'gk.shell', prompt: ['The crab wants the shell. What do we do?', 'السلطعون يريد الصدفة. ماذا نفعل؟'],
      options: [{ id: 'keep', emoji: '🐚', label: ['Keep it safe', 'نحافظ عليها'] }, { id: 'share', emoji: '🦀', label: ['Share with the crab', 'نشاركها مع السلطعون'] }] },
    activity2: { families: ['creation', 'matching'], purpose: ['Dress for the storm!', 'البس ملابس مناسبة للعاصفة!'] },
    finale: [ln('nova', ['The shell says: “Fly over the clouds to find the castle.” We need a plane!', 'الصدفة تقول: «طيروا فوق السحاب لتجدوا القلعة.» نحتاج طائرة!'], 'thinking')],
    cliffhanger: [ln('narrator', ['A plane with golden wings is waiting at Gate 7…', 'طائرة بأجنحة ذهبية تنتظر عند البوابة ٧…']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.shell', 'furniture.plant'],
  },
  {
    id: 'gk-09', arc: 'golden-key', order: 9, world: 'airport-adventures', minStage: 2, topics: ['travel', 'transport', 'directions'],
    title: ['Tickets to the Clouds', 'تذاكر إلى السحاب'],
    summary: ['Find your way through the airport to the golden plane.', 'جد طريقك عبر المطار إلى الطائرة الذهبية.'],
    intro: [
      ln('lumi', ['The airport is so big! We need to find Gate 7.', 'المطار كبير جدًا! نحتاج إلى إيجاد البوابة ٧.'], 'excited'),
      ln('zuzu', ['I packed everything! Bananas, more bananas, and a banana.', 'حزمت كل شيء! موز، ومزيد من الموز، وموزة.'], 'silly'),
    ],
    discover: ln('pico', ['Travellers always need this word.', 'المسافرون دائمًا يحتاجون هذه الكلمة.'], 'thinking', focus()),
    speak: ['Say it at the check-in desk!', 'قلها عند مكتب التسجيل!'],
    activity1: { families: ['movement', 'speaking'], purpose: ['Give directions through the airport maze.', 'أعطِ الاتجاهات عبر متاهة المطار.'] },
    activity2: { families: ['roleplay', 'listening'], purpose: ['Talk to the pilot.', 'تحدث مع الطيار.'] },
    finale: [ln('narrator', ['WHOOSH! The plane flies above the clouds… and there it is: the Magic Castle!', 'ووووش! الطائرة تطير فوق السحاب… وها هي: القلعة السحرية!'], 'excited')],
    cliffhanger: [ln('narrator', ['The castle has a hundred doors. Ninety-nine are fake…', 'للقلعة مئة باب. تسعة وتسعون منها مزيفة…']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.cloud', 'item.compass'],
  },
  {
    id: 'gk-10', arc: 'golden-key', order: 10, world: 'magic-castle', minStage: 2, topics: ['adventure', 'home', 'descriptions'],
    title: ['The Castle of a Hundred Doors', 'قلعة المئة باب'],
    summary: ['Explore the Hall of Doors. Only describing words open them.', 'استكشف قاعة الأبواب. فقط كلمات الوصف تفتحها.'],
    intro: [
      ln('narrator', ['Doors everywhere! Big doors, small doors, red doors, blue doors…', 'أبواب في كل مكان! أبواب كبيرة وصغيرة، حمراء وزرقاء…']),
      ln('nova', ['Each door opens when you describe it correctly.', 'كل باب يفتح عندما تصفه بشكل صحيح.'], 'thinking'),
    ],
    callbacks: [{ choiceKey: 'gk.puppy', optionId: '*', line: ln('lumi', ['You helped me find the puppy last week — you’re a great helper, {name}!', 'ساعدتني في إيجاد الجرو الأسبوع الماضي، أنت مساعد رائع يا {name}!'], 'happy') }],
    discover: ln('pico', ['This door has a word carved on it.', 'على هذا الباب كلمة محفورة.'], 'surprised', focus('focus1', 'np')),
    speak: ['Read the door out loud!', 'اقرأ الباب بصوت عالٍ!'],
    activity1: { families: ['puzzle', 'speaking'], purpose: ['Describe the doors to open them.', 'صف الأبواب لتفتحها.'] },
    activity2: { families: ['memory', 'listening'], purpose: ['Remember which doors were empty.', 'تذكر أي الأبواب كانت فارغة.'] },
    finale: [ln('lumi', ['Ninety-eight doors checked… two left: a red one and a blue one.', 'ثمانية وتسعون بابًا فحصناها… بقي اثنان: أحمر وأزرق.'], 'thinking')],
    cliffhanger: [ln('zuzu', ['Leave it to me! I’ll open one… right now!', 'اتركوه لي! سأفتح واحدًا… الآن!'], 'silly'), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.crown', 'clothing.crown'],
  },
  {
    id: 'gk-11', arc: 'golden-key', order: 11, world: 'magic-castle', minStage: 2, topics: ['descriptions', 'colors', 'adventure'],
    title: ['Zuzu Opens the Wrong Door', 'زوزو يفتح الباب الخطأ'],
    summary: ['Oops! Zuzu’s door is full of bouncing balloons. Fix the mix-up!', 'أوبس! باب زوزو مليء بالبالونات القافزة. أصلح الخلط!'],
    intro: [
      ln('narrator', ['POP! POP! A thousand balloons bounce out!', 'بوب! بوب! ألف بالون يقفز للخارج!'], 'surprised'),
      ln('zuzu', ['I said “open the door”… but I think I said “open the balloon”!', 'قلت «افتح الباب»… لكن أظنني قلت «افتح البالون»!'], 'silly'),
      ln('lumi', ['Let’s fix Zuzu’s mix-up. Listen carefully!', 'لنصلح خلط زوزو. استمع جيدًا!'], 'happy'),
    ],
    discover: ln('pico', ['The right word is…', 'الكلمة الصحيحة هي…'], 'thinking', focus()),
    speak: ['Teach Zuzu the right word!', 'علّم زوزو الكلمة الصحيحة!'],
    activity1: { families: ['movement', 'listening'], purpose: ['Pop the balloons with the right words!', 'فرقع البالونات ذات الكلمات الصحيحة!'] },
    choice: { key: 'gk.last-door', prompt: ['Which door is the golden one?', 'أي باب هو الذهبي؟'],
      options: [{ id: 'red', emoji: '🟥', label: ['The red door', 'الباب الأحمر'] }, { id: 'blue', emoji: '🟦', label: ['The blue door', 'الباب الأزرق'] }],
      after: [ln('nova', ['Good thinking! But both doors are painted… the gold is underneath!', 'تفكير جيد! لكن البابين مطليان… الذهب تحت الطلاء!'], 'surprised')] },
    activity2: { families: ['speaking', 'puzzle'], purpose: ['Say the magic words to wash the paint away.', 'قل الكلمات السحرية لتغسل الطلاء.'] },
    finale: [ln('lumi', ['It’s shining! The golden door! {name}, you have the key…', 'إنه يلمع! الباب الذهبي! يا {name}، المفتاح معك…'], 'excited')],
    cliffhanger: [ln('narrator', ['The key slides in. Click. Light pours out…', 'المفتاح يدخل. كليك. ضوء يتدفق…'], 'surprised'), ln('narrator', ['CUT! Tomorrow…', 'توقف! غدًا…'])],
    rewards: ['sticker.rainbow', 'mimo.bow'],
  },
  {
    id: 'gk-12', arc: 'golden-key', order: 12, world: 'magic-castle', minStage: 2, topics: ['adventure', 'travel', 'greetings'],
    title: ['The Golden Door', 'الباب الذهبي'],
    summary: ['The door opens… to the whole wide world.', 'الباب يُفتح… على العالم الواسع كله.'],
    intro: [
      ln('narrator', ['Behind the door is a room full of stars — and a giant spinning globe.', 'خلف الباب غرفة مليئة بالنجوم، وكرة أرضية ضخمة تدور.'], 'surprised'),
      ln('pico', ['It’s the World Explorer’s map room! Every country, every language…', 'إنها غرفة خرائط مستكشف العالم! كل بلد، كل لغة…'], 'excited'),
    ],
    callbacks: [
      { choiceKey: 'gk.shell', optionId: 'share', line: ln('bibi', ['The crab you shared with came to say thank you! He’s waving his claw!', 'السلطعون الذي شاركته جاء ليشكرك! إنه يلوّح بمخلبه!'], 'happy') },
      { choiceKey: 'gk.shell', optionId: 'keep', line: ln('bibi', ['Your shell is singing again — it knows we found the door!', 'صدفتك تغني مرة أخرى، إنها تعرف أننا وجدنا الباب!'], 'happy') },
      { choiceKey: 'gk.puppy', optionId: '*', line: ln('narrator', ['The puppy’s map piece fits perfectly into the globe!', 'قطعة خريطة الجرو تناسب الكرة الأرضية تمامًا!']) },
    ],
    discover: ln('lumi', ['Let’s say our favourite word from the whole adventure!', 'لنقل كلمتنا المفضلة من المغامرة كلها!'], 'happy', focus()),
    speak: ['Say it proudly!', 'قلها بفخر!'],
    activity1: { families: ['listening', 'memory'], purpose: ['Remember the places we visited.', 'تذكّر الأماكن التي زرناها.'] },
    activity2: { families: ['creation', 'speaking'], purpose: ['Build the celebration!', 'اصنع الاحتفال!'] },
    finale: [
      ln('mimo', ['Mimo spins with joy — and glows brighter than ever!', 'ميمو يدور فرحًا، ويتوهج أكثر من أي وقت مضى!'], 'excited'),
      ln('lumi', ['Thank you, {name}. We found the golden door together!', 'شكرًا يا {name}. وجدنا الباب الذهبي معًا!'], 'happy'),
    ],
    cliffhanger: [
      ln('narrator', ['But on the globe, one tiny island starts to blink… and a dragon roar echoes!', 'لكن على الكرة، جزيرة صغيرة تبدأ بالوميض… ويتردد زئير تنين!'], 'surprised'),
      ln('narrator', ['Season 2 begins soon…', 'الموسم الثاني يبدأ قريبًا…']),
    ],
    rewards: ['sticker.door', 'furniture.globe', 'mimo.sparkles'], memory: 'opened-golden-door',
  },
];

/* ═══════════════════════ FURTHER ARCS ═══════════════════════ */

function shortArc(
  arc: string, world: string, minStage: StageNumber, topics: TopicId[],
  parts: { title: T; summary: T; intro: [CharacterId | 'narrator', T, Emotion?][]; discover: T; act: [ActivityFamily[], T]; act2: [ActivityFamily[], T]; finale: T; cliff?: T; reward: string }[],
): EpisodeSpec[] {
  return parts.map((p, i) => ({
    id: `${arc}-${String(i + 1).padStart(2, '0')}`, arc, order: i + 1, world, minStage, topics,
    title: p.title, summary: p.summary,
    intro: p.intro.map(([sp, t, e]) => ln(sp, t, e)),
    discover: ln('pico', p.discover, 'thinking', focus()),
    speak: ['Say it out loud!', 'قلها بصوت عالٍ!'],
    activity1: { families: p.act[0], purpose: p.act[1] },
    activity2: { families: p.act2[0], purpose: p.act2[1] },
    finale: [ln('lumi', p.finale, 'happy')],
    cliffhanger: p.cliff ? [ln('narrator', p.cliff, 'surprised'), ln('narrator', ['Tomorrow…', 'غدًا…'])] : undefined,
    rewards: [p.reward],
  }));
}

const DRAGON = shortArc('dragon-egg', 'magic-castle', 2, ['adventure', 'colors', 'feelings'], [
  { title: ['The Missing Dragon Egg', 'بيضة التنين المفقودة'], summary: ['Mama Dragon’s egg has rolled away!', 'بيضة أم التنين تدحرجت بعيدًا!'],
    intro: [['narrator', ['A sad roar fills the castle garden.', 'زئير حزين يملأ حديقة القلعة.'], 'worried'], ['nova', ['The dragon’s egg is missing. Let’s find it!', 'بيضة التنين مفقودة. لنجدها!'], 'thinking']],
    discover: ['The egg is the same colour as this.', 'البيضة بنفس لون هذا.'], act: [['puzzle', 'listening'], ['Follow the clues around the garden.', 'تتبع الأدلة حول الحديقة.']],
    act2: [['memory', 'matching'], ['Match the eggs to their nests.', 'طابق البيض مع أعشاشه.']], finale: ['We found tracks — the egg rolled downhill!', 'وجدنا آثارًا، البيضة تدحرجت إلى الأسفل!'],
    cliff: ['Something warm is glowing inside a cave…', 'شيء دافئ يتوهج داخل كهف…'], reward: 'sticker.dragon' },
  { title: ['The Warm Cave', 'الكهف الدافئ'], summary: ['The egg is in a cave — but it’s dark!', 'البيضة في كهف، لكنه مظلم!'],
    intro: [['lumi', ['It’s so dark. Let’s use our voices to light the lanterns!', 'المكان مظلم جدًا. لنستخدم أصواتنا لنضيء الفوانيس!'], 'worried']],
    discover: ['Say this word to light a lantern.', 'قل هذه الكلمة لتضيء فانوسًا.'], act: [['speaking', 'movement'], ['Light the lanterns with your voice.', 'أضئ الفوانيس بصوتك.']],
    act2: [['listening', 'puzzle'], ['Find the egg among the stones.', 'جد البيضة بين الحجارة.']], finale: ['There it is! Warm and safe.', 'ها هي! دافئة وآمنة.'],
    cliff: ['Crack… crack… the egg is hatching!', 'طق… طق… البيضة تفقس!'], reward: 'item.lantern' },
  { title: ['Hello, Little Dragon', 'مرحبًا أيها التنين الصغير'], summary: ['A baby dragon is born and wants to learn words!', 'تنين صغير وُلد ويريد تعلم الكلمات!'],
    intro: [['narrator', ['A tiny dragon blinks at you and sneezes a sparkle.', 'تنين صغير يرمش لك ويعطس شرارة.'], 'happy'], ['zuzu', ['Bless you! Can he say banana?', 'يرحمك الله! هل يستطيع قول موزة؟'], 'silly']],
    discover: ['Teach the baby dragon this word.', 'علّم التنين الصغير هذه الكلمة.'], act: [['speaking', 'roleplay'], ['Teach the dragon new words.', 'علّم التنين كلمات جديدة.']],
    act2: [['music', 'listening'], ['Sing a lullaby for the dragon.', 'غنِّ تهويدة للتنين.']], finale: ['The little dragon is home with his mama. You were amazing!', 'التنين الصغير مع أمه في البيت. كنت مذهلًا!'], reward: 'mimo.hat' },
]);

const FOREST = shortArc('forest-mystery', 'animal-forest', 1, ['animals', 'nature', 'descriptions'], [
  { title: ['Whispers in the Trees', 'همسات في الأشجار'], summary: ['The animals are whispering. Something is different in the forest.', 'الحيوانات تهمس. شيء مختلف في الغابة.'],
    intro: [['nova', ['All the leaves have changed colour overnight!', 'كل الأوراق تغير لونها في ليلة واحدة!'], 'surprised']],
    discover: ['The first clue is this.', 'الدليل الأول هو هذا.'], act: [['listening', 'puzzle'], ['Ask the animals what they saw.', 'اسأل الحيوانات ماذا رأت.']],
    act2: [['matching', 'memory'], ['Sort the leaves by colour.', 'افرز الأوراق حسب اللون.']], finale: ['The animals say a rainbow fell into the river!', 'الحيوانات تقول إن قوس قزح سقط في النهر!'],
    cliff: ['The river is glowing in seven colours…', 'النهر يتوهج بسبعة ألوان…'], reward: 'sticker.rainbow' },
  { title: ['The Rainbow River', 'نهر قوس قزح'], summary: ['Help the rainbow get back into the sky.', 'ساعد قوس قزح على العودة إلى السماء.'],
    intro: [['bibi', ['If we sing every colour, the rainbow can fly again!', 'إذا غنينا كل لون، يستطيع قوس قزح الطيران مجددًا!'], 'excited']],
    discover: ['Start with this one!', 'ابدأ بهذا!'], act: [['music', 'speaking'], ['Sing the colours of the rainbow.', 'غنِّ ألوان قوس قزح.']],
    act2: [['movement', 'listening'], ['Catch the colours as they rise.', 'التقط الألوان وهي ترتفع.']], finale: ['The rainbow is back in the sky. The forest is cheering!', 'قوس قزح عاد إلى السماء. الغابة تهتف!'], reward: 'furniture.rug' },
  { title: ['The Forest Party', 'حفلة الغابة'], summary: ['The animals throw a party to say thank you.', 'الحيوانات تقيم حفلة لتقول شكرًا.'],
    intro: [['lumi', ['Everyone is here! What should we bring?', 'الجميع هنا! ماذا نحضر؟'], 'happy']],
    discover: ['The guest of honour is…', 'ضيف الشرف هو…'], act: [['roleplay', 'speaking'], ['Greet every animal at the party.', 'حيِّ كل حيوان في الحفلة.']],
    act2: [['creation', 'matching'], ['Decorate the party tree.', 'زيّن شجرة الحفلة.']], finale: ['What a wonderful party. The forest will remember you!', 'يا لها من حفلة رائعة. الغابة ستتذكرك!'], reward: 'furniture.plant' },
]);

const SPACE = shortArc('space-signal', 'space-world', 3, ['adventure', 'numbers', 'transport'], [
  { title: ['The Space Signal', 'إشارة الفضاء'], summary: ['Beep… beep… a signal from a faraway planet!', 'بيب… بيب… إشارة من كوكب بعيد!'],
    intro: [['pico', ['My telescope caught a signal. It’s counting!', 'تلسكوبي التقط إشارة. إنها تعد!'], 'surprised']],
    discover: ['The signal repeats this word.', 'الإشارة تكرر هذه الكلمة.'], act: [['listening', 'memory'], ['Decode the beeps in order.', 'فك شفرة الصفارات بالترتيب.']],
    act2: [['speaking', 'movement'], ['Countdown for launch!', 'العد التنازلي للإطلاق!']], finale: ['3, 2, 1… we’re flying to the stars!', '٣، ٢، ١… نحن نطير إلى النجوم!'],
    cliff: ['A friendly little robot waves from the planet below…', 'روبوت صغير ودود يلوّح من الكوكب في الأسفل…'], reward: 'sticker.rocket' },
  { title: ['Planet Hello', 'كوكب مرحبًا'], summary: ['Meet Bip, a robot who only knows numbers.', 'تعرّف على بيب، روبوت يعرف الأرقام فقط.'],
    intro: [['zuzu', ['Hello robot! I am Zuzu. Banana?', 'مرحبًا أيها الروبوت! أنا زوزو. موزة؟'], 'silly']],
    discover: ['Bip understands this word.', 'بيب يفهم هذه الكلمة.'], act: [['roleplay', 'speaking'], ['Teach Bip how to say hello.', 'علّم بيب كيف يقول مرحبًا.']],
    act2: [['puzzle', 'listening'], ['Fix Bip’s broken antenna.', 'أصلح هوائي بيب المكسور.']], finale: ['Bip can talk now! He says the signal was a party invitation.', 'بيب يستطيع الكلام الآن! يقول إن الإشارة كانت دعوة لحفلة.'],
    cliff: ['The party is on the Moon… tonight!', 'الحفلة على القمر… الليلة!'], reward: 'sticker.planet' },
  { title: ['Moon Party', 'حفلة القمر'], summary: ['Dance in low gravity with new friends.', 'ارقص في الجاذبية المنخفضة مع أصدقاء جدد.'],
    intro: [['bibi', ['Jump on the Moon — it’s so bouncy!', 'اقفز على القمر، إنه مرن جدًا!'], 'excited']],
    discover: ['On the Moon we need this word.', 'على القمر نحتاج هذه الكلمة.'], act: [['movement', 'speaking'], ['Give dance commands to the robots.', 'أعطِ أوامر الرقص للروبوتات.']],
    act2: [['music', 'memory'], ['Play the moon melody.', 'اعزف لحن القمر.']], finale: ['Best party in the galaxy!', 'أفضل حفلة في المجرة!'], reward: 'clothing.space' },
]);

const DINO = shortArc('dino-map', 'dinosaur-island', 3, ['adventure', 'animals', 'directions'], [
  { title: ['The Dinosaur Map', 'خريطة الديناصورات'], summary: ['An old map shows where the dinosaurs hide their nests.', 'خريطة قديمة تظهر أين تخبئ الديناصورات أعشاشها.'],
    intro: [['nova', ['The map has arrows and pictures. Let’s read it!', 'الخريطة فيها أسهم وصور. لنقرأها!'], 'thinking']],
    discover: ['The first picture on the map is this.', 'أول صورة على الخريطة هي هذه.'], act: [['movement', 'speaking'], ['Follow the map’s directions.', 'اتبع اتجاهات الخريطة.']],
    act2: [['listening', 'puzzle'], ['Find the hidden footprints.', 'جد آثار الأقدام المخفية.']], finale: ['We reached the volcano path!', 'وصلنا إلى طريق البركان!'],
    cliff: ['The ground shakes… STOMP… STOMP…', 'الأرض تهتز… دوم… دوم…'], reward: 'sticker.dino' },
  { title: ['The Gentle Giant', 'العملاق اللطيف'], summary: ['A huge dinosaur blocks the path — but it’s just shy.', 'ديناصور ضخم يسد الطريق، لكنه خجول فقط.'],
    intro: [['lumi', ['Don’t be scared — he’s smiling!', 'لا تخف، إنه يبتسم!'], 'happy']],
    discover: ['The dinosaur likes this.', 'الديناصور يحب هذا.'], act: [['roleplay', 'speaking'], ['Make friends with the dinosaur.', 'صادق الديناصور.']],
    act2: [['matching', 'listening'], ['Feed the dinosaur its favourite food.', 'أطعم الديناصور طعامه المفضل.']], finale: ['He lets us ride on his back to the nests!', 'يسمح لنا بالركوب على ظهره إلى الأعشاش!'],
    cliff: ['One nest has a strange golden egg…', 'أحد الأعشاش فيه بيضة ذهبية غريبة…'], reward: 'item.telescope' },
  { title: ['The Nest of Wonders', 'عش العجائب'], summary: ['Count the eggs and keep them safe.', 'عدّ البيض واحفظه بأمان.'],
    intro: [['pico', ['So many eggs! Let’s count them carefully.', 'بيض كثير! لنعدّه بعناية.'], 'thinking']],
    discover: ['The golden egg is next to this.', 'البيضة الذهبية بجانب هذا.'], act: [['puzzle', 'listening'], ['Count and sort the eggs.', 'عدّ البيض وافرزه.']],
    act2: [['creation', 'speaking'], ['Build a cosy nest.', 'ابنِ عشًا مريحًا.']], finale: ['All the eggs are safe. The island thanks you!', 'كل البيض آمن. الجزيرة تشكرك!'], reward: 'mimo.scarf' },
]);

const CASTLE = shortArc('castle-room', 'magic-castle', 3, ['adventure', 'home', 'descriptions'], [
  { title: ['The Secret Castle Room', 'غرفة القلعة السرية'], summary: ['A painting in the castle moves its eyes…', 'لوحة في القلعة تحرك عينيها…'],
    intro: [['nova', ['Did you see that? The painting blinked!', 'هل رأيت ذلك؟ اللوحة رمشت!'], 'surprised']],
    discover: ['Behind the painting there is a…', 'خلف اللوحة يوجد…'], act: [['puzzle', 'listening'], ['Find the secret switch.', 'جد المفتاح السري.']],
    act2: [['speaking', 'memory'], ['Say the password to the painting.', 'قل كلمة السر للوحة.']], finale: ['A secret staircase appears!', 'يظهر درج سري!'],
    cliff: ['At the top, someone is humming a song…', 'في الأعلى، أحدهم يدندن أغنية…'], reward: 'sticker.crown' },
  { title: ['The Singing Queen', 'الملكة المغنية'], summary: ['The queen lost her voice — help her sing again.', 'الملكة فقدت صوتها، ساعدها لتغني مجددًا.'],
    intro: [['bibi', ['A queen who loves music? She’s my hero!', 'ملكة تحب الموسيقى؟ إنها بطلتي!'], 'excited']],
    discover: ['Her favourite song starts with…', 'أغنيتها المفضلة تبدأ بـ…'], act: [['music', 'speaking'], ['Sing the queen’s song.', 'غنِّ أغنية الملكة.']],
    act2: [['roleplay', 'listening'], ['Have tea with the queen.', 'اشرب الشاي مع الملكة.']], finale: ['The queen sings again. The whole castle dances!', 'الملكة تغني مجددًا. القلعة كلها ترقص!'], reward: 'clothing.cape' },
]);

const OCEAN = shortArc('underwater-city', 'underwater-world', 3, ['adventure', 'animals', 'colors'], [
  { title: ['Bubbles from Below', 'فقاعات من الأعماق'], summary: ['Strange bubbles spell out words!', 'فقاعات غريبة تكتب كلمات!'],
    intro: [['lumi', ['Let’s put on our diving masks!', 'لنضع أقنعة الغوص!'], 'excited']],
    discover: ['The bubbles spell this word.', 'الفقاعات تكتب هذه الكلمة.'], act: [['listening', 'movement'], ['Pop the right bubbles.', 'فرقع الفقاعات الصحيحة.']],
    act2: [['matching', 'memory'], ['Match the sea creatures.', 'طابق كائنات البحر.']], finale: ['The bubbles lead to a sunken city!', 'الفقاعات تقود إلى مدينة غارقة!'],
    cliff: ['An octopus guards the city gate…', 'أخطبوط يحرس بوابة المدينة…'], reward: 'sticker.shell' },
  { title: ['The Octopus Guard', 'الأخطبوط الحارس'], summary: ['The octopus asks eight questions — one per arm!', 'الأخطبوط يسأل ثمانية أسئلة، سؤال لكل ذراع!'],
    intro: [['zuzu', ['Eight arms! He can eat eight bananas at once!', 'ثماني أذرع! يستطيع أكل ثماني موزات مرة واحدة!'], 'silly']],
    discover: ['His first question is about this.', 'سؤاله الأول عن هذا.'], act: [['puzzle', 'speaking'], ['Answer the octopus.', 'أجب الأخطبوط.']],
    act2: [['listening', 'memory'], ['Remember the gate code.', 'تذكر رمز البوابة.']], finale: ['The gate opens! Welcome to the Underwater City!', 'البوابة تفتح! مرحبًا بك في المدينة تحت الماء!'],
    cliff: ['The city’s lights are going out…', 'أضواء المدينة تنطفئ…'], reward: 'item.compass' },
  { title: ['Light Up the City', 'أضئ المدينة'], summary: ['Use colour words to relight the coral lamps.', 'استخدم كلمات الألوان لتضيء مصابيح المرجان.'],
    intro: [['pico', ['Each coral lamp lights up with a colour word.', 'كل مصباح مرجاني يضيء بكلمة لون.'], 'thinking']],
    discover: ['The first lamp needs…', 'المصباح الأول يحتاج…'], act: [['speaking', 'movement'], ['Light the coral lamps.', 'أضئ مصابيح المرجان.']],
    act2: [['creation', 'listening'], ['Design a new coral garden.', 'صمم حديقة مرجان جديدة.']], finale: ['The city sparkles again. The fish are dancing!', 'المدينة تتلألأ مجددًا. الأسماك ترقص!'], reward: 'furniture.lamp' },
]);

const WINTER = shortArc('winter-wonder', 'nature-mountain', 2, ['weather', 'clothing', 'calendar'], [
  { title: ['The Snowy Surprise', 'مفاجأة الثلج'], summary: ['It’s snowing in LingoWorld for the very first time!', 'إنها تثلج في لينغو وورلد لأول مرة!'],
    intro: [['lumi', ['Everything is white! Let’s get dressed for the snow.', 'كل شيء أبيض! لنلبس ملابس الثلج.'], 'excited']],
    discover: ['In the snow, we need this.', 'في الثلج نحتاج هذا.'], act: [['creation', 'listening'], ['Dress up warmly.', 'البس ملابس دافئة.']],
    act2: [['movement', 'speaking'], ['Build a snow friend with your voice.', 'ابنِ صديقًا من الثلج بصوتك.']], finale: ['Our snow friend is waving at us!', 'صديقنا الثلجي يلوّح لنا!'], reward: 'clothing.cap' },
  { title: ['The Cosy Cabin', 'الكوخ الدافئ'], summary: ['Warm up with friends and stories.', 'تدفأ مع الأصدقاء والقصص.'],
    intro: [['bibi', ['Brrr! Let’s go inside the cabin and sing!', 'بررر! لندخل الكوخ ونغني!'], 'happy']],
    discover: ['In the cabin there is a…', 'في الكوخ يوجد…'], act: [['music', 'speaking'], ['Sing the winter song.', 'غنِّ أغنية الشتاء.']],
    act2: [['story', 'listening'], ['Listen to Pico’s winter story.', 'استمع إلى قصة بيكو الشتوية.']], finale: ['Warm, happy and full of new words!', 'دافئون وسعداء ومليئون بكلمات جديدة!'], reward: 'furniture.sofa' },
]);


/* ═══════════════ LITTLE EXPLORERS SEASON · MIMO'S FIRST FRIENDS (ages 4–5) ═══════════════
 * Short episodes: two lines of story, one word to say, two playful games. Everything is voiced.
 */
function littleArc(arc: string, parts: { world: string; topics: TopicId[]; title: T; summary: T; intro: [CharacterId | 'narrator', T, Emotion?][]; discover: T; act: ActivityFamily[]; act2: ActivityFamily[]; finale: T; cliff?: T; reward: string }[]): EpisodeSpec[] {
  return parts.map((p, i) => ({
    id: `${arc}-${String(i + 1).padStart(2, '0')}`, arc, order: i + 1, world: p.world, minStage: 1, topics: p.topics,
    title: p.title, summary: p.summary,
    intro: p.intro.map(([sp, t, e]) => ln(sp, t, e)),
    discover: ln('lumi', p.discover, 'excited', focus('focus1', 'word')),
    speak: ['Say it!', 'قلها!'],
    activity1: { families: p.act, purpose: ['Let’s play!', 'هيا نلعب!'] },
    activity2: { families: p.act2, purpose: ['One more game!', 'لعبة أخرى!'] },
    finale: [ln('mimo', p.finale, 'happy')],
    cliffhanger: p.cliff ? [ln('narrator', p.cliff, 'surprised'), ln('narrator', ['Tomorrow…', 'غدًا…'])] : undefined,
    rewards: [p.reward],
  }));
}

const FIRST_FRIENDS = littleArc('first-friends', [
  { world: 'my-home', topics: ['greetings', 'colors'], title: ['Hello, Mimo!', 'مرحبًا يا ميمو!'], summary: ['A magic egg wiggles. Say hello!', 'بيضة سحرية تتحرك. قل مرحبًا!'],
    intro: [['lumi', ['Hello, {name}! Look — an egg!', 'مرحبًا يا {name}! انظر — بيضة!'], 'excited'], ['narrator', ['Wiggle, wiggle…', 'تتحرك، تتحرك…'], 'surprised']],
    discover: ['Let’s say hello!', 'لنقل مرحبًا!'], act: ['listening', 'movement'], act2: ['music', 'matching'],
    finale: ['Peep! Peep!', 'بيب! بيب!'], cliff: ['The egg glows… red, blue, yellow!', 'البيضة تتوهج… أحمر، أزرق، أصفر!'], reward: 'sticker.star' },
  { world: 'my-home', topics: ['colors', 'toys'], title: ['Colour Surprise', 'مفاجأة الألوان'], summary: ['Find toys of every colour for Mimo.', 'جد ألعابًا بكل الألوان لميمو.'],
    intro: [['lumi', ['Mimo loves colours!', 'ميمو يحب الألوان!'], 'happy']],
    discover: ['What colour is this?', 'ما هذا اللون؟'], act: ['listening', 'movement'], act2: ['memory', 'matching'],
    finale: ['Wow! So many colours!', 'واو! ألوان كثيرة!'], cliff: ['Mimo hears a puppy outside. Woof!', 'ميمو يسمع جروًا في الخارج. هاو!'], reward: 'sticker.rainbow' },
  { world: 'playground-park', topics: ['animals', 'actions'], title: ['A Puppy at the Park', 'جرو في الحديقة'], summary: ['Play with a friendly puppy.', 'العب مع جرو لطيف.'],
    intro: [['zuzu', ['A puppy! Hello, puppy!', 'جرو! مرحبًا أيها الجرو!'], 'silly'], ['lumi', ['Let’s play together!', 'لنلعب معًا!'], 'happy']],
    discover: ['Who is this?', 'من هذا؟'], act: ['movement', 'listening'], act2: ['speaking', 'movement'],
    finale: ['Jump, jump, jump!', 'اقفز، اقفز، اقفز!'], cliff: ['The puppy runs into the forest!', 'الجرو يركض إلى الغابة!'], reward: 'sticker.puppy' },
  { world: 'animal-forest', topics: ['animals', 'nature'], title: ['Forest Friends', 'أصدقاء الغابة'], summary: ['Meet the animals of the forest.', 'تعرّف على حيوانات الغابة.'],
    intro: [['lumi', ['Shh… listen. Who is there?', 'هس… استمع. من هناك؟'], 'thinking']],
    discover: ['I hear…', 'أسمع…'], act: ['listening', 'music'], act2: ['matching', 'memory'],
    finale: ['Hello, friends!', 'مرحبًا يا أصدقاء!'], cliff: ['A bird sings a funny song…', 'طائر يغني أغنية مضحكة…'], reward: 'sticker.owl' },
  { world: 'music-valley', topics: ['numbers', 'actions'], title: ['Bibi’s Song', 'أغنية بيبي'], summary: ['Count and dance with Bibi.', 'عُدّ وارقص مع بيبي.'],
    intro: [['bibi', ['Tweet! Let’s sing and count!', 'تويت! لنغنِّ ونعد!'], 'excited']],
    discover: ['Count with me!', 'عُدّ معي!'], act: ['music', 'listening'], act2: ['movement', 'speaking'],
    finale: ['La la la! Mimo dances!', 'لا لا لا! ميمو يرقص!'], cliff: ['Mimo is hungry… tummy rumbles!', 'ميمو جائع… بطنه يقرقر!'], reward: 'sticker.music' },
  { world: 'supermarket-city', topics: ['food', 'colors'], title: ['Yummy Shopping', 'تسوق لذيذ'], summary: ['Find Mimo’s favourite food.', 'جد طعام ميمو المفضل.'],
    intro: [['zuzu', ['Banana? Apple? Cake?', 'موزة؟ تفاحة؟ كعكة؟'], 'silly']],
    discover: ['Mimo wants…', 'ميمو يريد…'], act: ['movement', 'listening'], act2: ['matching', 'roleplay'],
    finale: ['Yum yum! Thank you!', 'يم يم! شكرًا!'], cliff: ['Splash! Waves at the beach…', 'رشرشة! أمواج على الشاطئ…'], reward: 'sticker.cookie' },
  { world: 'beach-island', topics: ['nature', 'weather'], title: ['Sunny Beach', 'شاطئ مشمس'], summary: ['Play in the sun and sand.', 'العب في الشمس والرمل.'],
    intro: [['lumi', ['The sun is hot! Let’s play!', 'الشمس حارة! لنلعب!'], 'happy']],
    discover: ['Look up!', 'انظر إلى الأعلى!'], act: ['listening', 'movement'], act2: ['creation', 'matching'],
    finale: ['What a fun day!', 'يا له من يوم ممتع!'], cliff: ['Mimo yawns… time for a surprise party?', 'ميمو يتثاءب… حان وقت حفلة مفاجئة؟'], reward: 'sticker.shell' },
  { world: 'my-home', topics: ['family', 'feelings'], title: ['Mimo’s Party', 'حفلة ميمو'], summary: ['All the friends come to say hello.', 'كل الأصدقاء يأتون ليقولوا مرحبًا.'],
    intro: [['narrator', ['Knock, knock! Friends are here!', 'طق طق! الأصدقاء هنا!'], 'excited']],
    discover: ['Say it to your friends!', 'قلها لأصدقائك!'], act: ['music', 'speaking'], act2: ['creation', 'listening'],
    finale: ['Best friends forever!', 'أصدقاء إلى الأبد!'], reward: 'mimo.bow' },
]);

/* ═══════════════ HEROES SEASON · THE CLOCKTOWER CODE (ages 9–11) ═══════════════
 * Longer mystery: reading clues, building sentences, role-play conversations, real choices.
 */
const CLOCK: EpisodeSpec[] = [
  { id: 'clock-01', arc: 'clocktower-code', order: 1, world: 'school-town', minStage: 1, topics: ['school', 'time', 'questions'],
    title: ['The Stopped Clock', 'الساعة المتوقفة'], summary: ['Every clock in School Town stopped at 3:00. Nova needs a partner.', 'كل ساعات مدينة المدرسة توقفت عند الثالثة. نوفا تحتاج شريكًا.'],
    intro: [
      ln('nova', ['{name}, every clock in town stopped at exactly three o’clock. That’s not an accident.', 'يا {name}، كل ساعات المدينة توقفت عند الثالثة تمامًا. هذه ليست صدفة.'], 'thinking'),
      ln('nova', ['I keep a case notebook. Every clue gets written down — in the language we’re learning.', 'لدي دفتر قضايا. كل دليل يُكتب — باللغة التي نتعلمها.'], 'happy'),
      ln('pico', ['Detectives ask good questions. Here is our first one.', 'المحققون يسألون أسئلة جيدة. هذا سؤالنا الأول.'], 'thinking', { phraseId: 'q.what_is_this' }),
    ],
    discover: ln('nova', ['Clue number one is written under the clock face.', 'الدليل الأول مكتوب تحت وجه الساعة.'], 'surprised', focus('focus1', 'this-is')),
    speak: ['Read the clue aloud for the notebook.', 'اقرأ الدليل بصوت عالٍ للدفتر.'],
    activity1: { families: ['puzzle', 'listening'], purpose: ['Rebuild the scrambled clue.', 'أعد تركيب الدليل المبعثر.'] },
    choice: { key: 'clock.first-lead', prompt: ['Who do we question first?', 'من نستجوب أولًا؟'],
      options: [{ id: 'teacher', emoji: '🧑‍🏫', label: ['The teacher', 'المعلمة'] }, { id: 'baker', emoji: '🥐', label: ['The baker', 'الخبّاز'] }] },
    activity2: { families: ['roleplay', 'speaking'], purpose: ['Ask polite questions to get information.', 'اطرح أسئلة مهذبة لتحصل على معلومات.'] },
    finale: [ln('nova', ['Someone left a note: “The answer is where books sleep.”', 'شخص ما ترك ملاحظة: «الجواب حيث تنام الكتب».'], 'surprised')],
    cliffhanger: [ln('narrator', ['In the library, one book is ticking.', 'في المكتبة، كتاب واحد يدق.'], 'surprised'), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.footprint'], memory: 'joined-nova' },
  { id: 'clock-02', arc: 'clocktower-code', order: 2, world: 'school-town', minStage: 1, topics: ['school', 'descriptions', 'numbers'],
    title: ['The Ticking Book', 'الكتاب الذي يدق'], summary: ['A hidden code inside a library book.', 'شفرة مخفية داخل كتاب في المكتبة.'],
    intro: [ln('pico', ['A book that ticks? Open it carefully.', 'كتاب يدق؟ افتحه بحذر.'], 'surprised'), ln('nova', ['Numbers! Twelve, three, seven… it’s a code.', 'أرقام! اثنا عشر، ثلاثة، سبعة… إنها شفرة.'], 'thinking')],
    callbacks: [
      { choiceKey: 'clock.first-lead', optionId: 'teacher', line: ln('nova', ['The teacher told us the library was locked at three. Interesting…', 'المعلمة أخبرتنا أن المكتبة أُغلقت عند الثالثة. مثير…'], 'thinking') },
      { choiceKey: 'clock.first-lead', optionId: 'baker', line: ln('nova', ['The baker said a stranger bought bread at three. Our first suspect!', 'الخبّاز قال إن غريبًا اشترى خبزًا عند الثالثة. أول مشتبه به!'], 'thinking') },
    ],
    discover: ln('pico', ['The code word is…', 'كلمة الشفرة هي…'], 'thinking', focus('focus1', 'np')),
    speak: ['Say the code word clearly.', 'قل كلمة الشفرة بوضوح.'],
    activity1: { families: ['puzzle', 'matching'], purpose: ['Spell the code word letter by letter.', 'تهجَّ كلمة الشفرة حرفًا حرفًا.'] },
    activity2: { families: ['memory', 'listening'], purpose: ['Remember the number sequence.', 'تذكّر تسلسل الأرقام.'] },
    finale: [ln('nova', ['The code points to the market. Someone there knows something.', 'الشفرة تشير إلى السوق. شخص هناك يعرف شيئًا.'], 'excited')],
    cliffhanger: [ln('narrator', ['A shadow slips behind the fruit stand…', 'ظل يختبئ خلف كشك الفاكهة…']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['item.compass'] },
  { id: 'clock-03', arc: 'clocktower-code', order: 3, world: 'supermarket-city', minStage: 1, topics: ['shopping', 'food', 'numbers'],
    title: ['Undercover at the Market', 'متخفّون في السوق'], summary: ['Shop like a local to get the next clue.', 'تسوّق مثل أهل البلد لتحصل على الدليل التالي.'],
    intro: [ln('nova', ['We blend in. You do the talking — I’ll watch.', 'سنندمج. أنت تتكلم — وأنا أراقب.'], 'thinking')],
    discover: ln('zuzu', ['I’m undercover too! I’m a… pineapple.', 'أنا متخفٍّ أيضًا! أنا… أناناسة.'], 'silly', focus('focus1', 'i-see')),
    speak: ['Tell the shopkeeper what you see.', 'أخبر البائع بما تراه.'],
    activity1: { families: ['roleplay', 'listening'], purpose: ['Buy exactly what the clue lists.', 'اشترِ بالضبط ما يذكره الدليل.'] },
    choice: { key: 'clock.shadow', prompt: ['The shadow drops a ticket. What do we do?', 'الظل يُسقط تذكرة. ماذا نفعل؟'],
      options: [{ id: 'follow', emoji: '👣', label: ['Follow the shadow', 'نتبع الظل'] }, { id: 'ticket', emoji: '🎫', label: ['Read the ticket', 'نقرأ التذكرة'] }] },
    activity2: { families: ['puzzle', 'matching'], purpose: ['Sort the receipts to find the odd one out.', 'رتّب الإيصالات لتجد المختلف.'] },
    finale: [ln('nova', ['The ticket says: Playground Park, 3:00.', 'التذكرة تقول: حديقة الألعاب، الثالثة.'], 'surprised')],
    cliffhanger: [ln('narrator', ['At the park, the swings move by themselves…', 'في الحديقة، الأراجيح تتحرك وحدها…']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.cloud'] },
  { id: 'clock-04', arc: 'clocktower-code', order: 4, world: 'playground-park', minStage: 2, topics: ['directions', 'actions', 'descriptions'],
    title: ['Directions in the Dark', 'اتجاهات في الظلام'], summary: ['Guide Nova through the park using only your voice.', 'وجّه نوفا عبر الحديقة بصوتك فقط.'],
    intro: [ln('nova', ['It’s too dark to see. I’ll walk — you give the directions.', 'المكان مظلم جدًا. سأمشي — وأنت تعطي الاتجاهات.'], 'worried')],
    callbacks: [{ choiceKey: 'clock.shadow', optionId: 'follow', line: ln('nova', ['Good instinct following that shadow — it came this way.', 'حدس جيد أن تتبعنا الظل — لقد جاء من هنا.'], 'thinking') }],
    discover: ln('pico', ['Precise directions save time.', 'الاتجاهات الدقيقة توفّر الوقت.'], 'thinking', focus('focus1', 'word')),
    speak: ['Say the direction word.', 'قل كلمة الاتجاه.'],
    activity1: { families: ['movement', 'speaking'], purpose: ['Steer Nova through the maze by voice.', 'وجّه نوفا عبر المتاهة بصوتك.'] },
    activity2: { families: ['listening', 'puzzle'], purpose: ['Find where the footprints lead.', 'جد إلى أين تقود الآثار.'] },
    finale: [ln('nova', ['Under the slide: a tiny golden gear!', 'تحت الزحليقة: ترس ذهبي صغير!'], 'excited')],
    cliffhanger: [ln('narrator', ['The gear is stamped with an owl… Pico goes very quiet.', 'الترس عليه ختم بومة… بيكو يصمت تمامًا.']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['item.lantern'] },
  { id: 'clock-05', arc: 'clocktower-code', order: 5, world: 'animal-forest', minStage: 2, topics: ['animals', 'nature', 'feelings'],
    title: ['Pico’s Secret', 'سر بيكو'], summary: ['Pico admits he knows who built the clocks.', 'بيكو يعترف أنه يعرف من صنع الساعات.'],
    intro: [ln('pico', ['That owl stamp… belongs to my old teacher, the Clockmaker.', 'ختم البومة هذا… يخص معلمي القديم، صانع الساعات.'], 'worried'), ln('nova', ['Why didn’t you tell us?', 'لماذا لم تخبرنا؟'], 'surprised')],
    discover: ln('pico', ['The Clockmaker lives near this.', 'صانع الساعات يعيش قرب هذا.'], 'thinking', focus('focus1', 'this-is')),
    speak: ['Repeat it for the notebook.', 'كرّرها للدفتر.'],
    activity1: { families: ['story', 'listening'], purpose: ['Listen to Pico’s story and answer.', 'استمع إلى قصة بيكو وأجب.'] },
    choice: { key: 'clock.trust', prompt: ['Do we still trust Pico?', 'هل ما زلنا نثق ببيكو؟'],
      options: [{ id: 'trust', emoji: '🤝', label: ['Yes — he told the truth', 'نعم — قال الحقيقة'] }, { id: 'careful', emoji: '🔍', label: ['Yes, but we check his clues', 'نعم، لكن نتحقق من أدلته'] }] },
    activity2: { families: ['matching', 'memory'], purpose: ['Match each animal to its tracks.', 'طابق كل حيوان مع آثاره.'] },
    finale: [ln('nova', ['The trail continues to the sea.', 'الأثر يستمر نحو البحر.'], 'thinking')],
    cliffhanger: [ln('narrator', ['On the beach, a message in a bottle — written backwards.', 'على الشاطئ، رسالة في زجاجة — مكتوبة بالمقلوب.']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.owl'] },
  { id: 'clock-06', arc: 'clocktower-code', order: 6, world: 'beach-island', minStage: 2, topics: ['weather', 'nature', 'clothing'],
    title: ['The Backwards Message', 'الرسالة المقلوبة'], summary: ['Decode a message before the tide comes in.', 'فك شفرة رسالة قبل أن يأتي المد.'],
    intro: [ln('nova', ['Every word is reversed. Let’s rebuild the sentences.', 'كل كلمة مقلوبة. لنُعِد بناء الجمل.'], 'thinking')],
    callbacks: [{ choiceKey: 'clock.trust', optionId: 'careful', line: ln('pico', ['I checked this clue twice — just as you asked.', 'تحققت من هذا الدليل مرتين — كما طلبت.'], 'happy') }],
    discover: ln('nova', ['The first decoded word is…', 'أول كلمة فككناها هي…'], 'excited', focus('focus1', 'np')),
    speak: ['Say the decoded word.', 'قل الكلمة المفكوكة.'],
    activity1: { families: ['puzzle', 'listening'], purpose: ['Put the message back in order.', 'أعد ترتيب الرسالة.'] },
    activity2: { families: ['creation', 'speaking'], purpose: ['Write your own coded reply.', 'اكتب ردك المشفّر.'] },
    finale: [ln('nova', ['“Meet me where planes sleep.” The airport!', '«قابلني حيث تنام الطائرات». المطار!'], 'surprised')],
    cliffhanger: [ln('narrator', ['A ticket in your name is waiting at Gate 3…', 'تذكرة باسمك تنتظر عند البوابة ٣…']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.shell'] },
  { id: 'clock-07', arc: 'clocktower-code', order: 7, world: 'airport-adventures', minStage: 2, topics: ['travel', 'transport', 'time'],
    title: ['Gate 3', 'البوابة ٣'], summary: ['Talk your way through the airport to meet the Clockmaker.', 'تحدّث لتعبر المطار وتقابل صانع الساعات.'],
    intro: [ln('nova', ['Ticket, questions, directions. Ready?', 'تذكرة، أسئلة، اتجاهات. جاهز؟'], 'excited')],
    discover: ln('pico', ['At the airport you’ll need…', 'في المطار ستحتاج…'], 'thinking', focus('focus1', 'give-me')),
    speak: ['Ask for it politely.', 'اطلبها بأدب.'],
    activity1: { families: ['roleplay', 'speaking'], purpose: ['Check in and answer the agent.', 'سجّل وأجب الموظف.'] },
    activity2: { families: ['listening', 'movement'], purpose: ['Follow the announcements to Gate 3.', 'اتبع الإعلانات إلى البوابة ٣.'] },
    finale: [ln('pico', ['There she is — the Clockmaker. She’s smiling.', 'ها هي — صانعة الساعات. إنها تبتسم.'], 'surprised')],
    cliffhanger: [ln('narrator', ['“You found me,” she says. “Now help me fix time itself.”', '«وجدتموني»، تقول. «والآن ساعدوني لأصلح الوقت نفسه».']), ln('narrator', ['Tomorrow…', 'غدًا…'])],
    rewards: ['sticker.cloud'] },
  { id: 'clock-08', arc: 'clocktower-code', order: 8, world: 'magic-castle', minStage: 2, topics: ['time', 'calendar', 'questions'],
    title: ['Fixing Time', 'إصلاح الوقت'], summary: ['Restart the Great Clock with everything you learned.', 'أعد تشغيل الساعة الكبرى بكل ما تعلمته.'],
    intro: [ln('nova', ['The clocks stopped so someone would come looking. The Clockmaker was testing us.', 'توقفت الساعات كي يأتي أحد ليبحث. صانعة الساعات كانت تختبرنا.'], 'thinking')],
    callbacks: [{ choiceKey: 'clock.first-lead', optionId: '*', line: ln('nova', ['Remember our very first question in School Town? It all started there.', 'تذكر أول سؤال لنا في مدينة المدرسة؟ كل شيء بدأ هناك.'], 'happy') }],
    discover: ln('pico', ['The final gear is labelled…', 'الترس الأخير مكتوب عليه…'], 'excited', focus('focus1', 'this-is')),
    speak: ['Say the final word to start the clock.', 'قل الكلمة الأخيرة لتشغيل الساعة.'],
    activity1: { families: ['puzzle', 'memory'], purpose: ['Place every gear in order.', 'ضع كل ترس في مكانه.'] },
    activity2: { families: ['speaking', 'story'], purpose: ['Tell the town what happened.', 'أخبر المدينة بما حدث.'] },
    finale: [ln('nova', ['Tick… tock… Every clock in LingoWorld starts again. Case closed, partner.', 'تك… توك… كل ساعات لينغو وورلد تعمل من جديد. القضية مغلقة يا شريكي.'], 'excited')],
    cliffhanger: [ln('narrator', ['A letter arrives with a space stamp: “Detectives needed on the Moon.”', 'تصل رسالة بطابع فضائي: «مطلوب محققون على القمر».'], 'surprised'), ln('narrator', ['Next season…', 'الموسم القادم…'])],
    rewards: ['sticker.door', 'clothing.glasses'], memory: 'solved-clocktower' },
];

export const EPISODES: Episode[] = [...GK, ...DRAGON, ...FOREST, ...SPACE, ...DINO, ...CASTLE, ...OCEAN, ...WINTER, ...FIRST_FRIENDS, ...CLOCK].map(episode);

const arcOf = (id: string, en: string, ar: string, den: string, dar: string, worldIds: string[], season: number | null, premium: boolean, seasonal?: StoryArc['seasonal']): StoryArc => ({
  id, title: { en, ar }, description: { en: den, ar: dar }, season, worldIds, premium, seasonal, status: 'published',
  episodeIds: EPISODES.filter((e) => e.arcId === id).sort((a, b) => a.order - b.order).map((e) => e.id),
});

export const ARCS: StoryArc[] = [
  arcOf('golden-key', 'The Golden Key', 'المفتاح الذهبي', 'A golden key falls from the sky. Which door does it open?', 'مفتاح ذهبي يسقط من السماء. أي باب يفتح؟',
    ['my-home', 'playground-park', 'school-town', 'supermarket-city', 'animal-forest', 'beach-island', 'airport-adventures', 'magic-castle'], 1, false),
  arcOf('forest-mystery', 'The Mystery of the Forest', 'لغز الغابة', 'The forest changed colour overnight.', 'الغابة غيّرت لونها في ليلة.', ['animal-forest'], null, false),
  arcOf('dragon-egg', 'The Missing Dragon Egg', 'بيضة التنين المفقودة', 'Help Mama Dragon find her egg.', 'ساعد أم التنين في إيجاد بيضتها.', ['magic-castle'], null, true),
  arcOf('space-signal', 'The Space Signal', 'إشارة الفضاء', 'A mysterious signal from the stars.', 'إشارة غامضة من النجوم.', ['space-world'], null, true),
  arcOf('dino-map', 'The Dinosaur Map', 'خريطة الديناصورات', 'Follow the map to the dinosaur nests.', 'اتبع الخريطة إلى أعشاش الديناصورات.', ['dinosaur-island'], null, true),
  arcOf('castle-room', 'The Secret Castle Room', 'غرفة القلعة السرية', 'A hidden room behind a painting.', 'غرفة مخفية خلف لوحة.', ['magic-castle'], null, true),
  arcOf('underwater-city', 'The Underwater City', 'المدينة تحت الماء', 'Dive into a sparkling sunken city.', 'اغطس في مدينة غارقة متلألئة.', ['underwater-world'], null, true),
  arcOf('first-friends', 'Mimo’s First Friends', 'أصدقاء ميمو الأوائل', 'A gentle first season for Little Explorers: say hello, find colours, meet animals.', 'موسم أول لطيف للمستكشفين الصغار.',
    ['my-home', 'playground-park', 'animal-forest', 'music-valley', 'supermarket-city', 'beach-island'], 1, false),
  arcOf('clocktower-code', 'The Clocktower Code', 'شفرة برج الساعة', 'A mystery season for Heroes: read clues, build sentences, question suspects.', 'موسم غامض للأبطال: اقرأ الأدلة وابنِ الجمل واستجوب المشتبه بهم.',
    ['school-town', 'supermarket-city', 'playground-park', 'animal-forest', 'beach-island', 'airport-adventures', 'magic-castle'], 1, false),
  arcOf('winter-wonder', 'Winter Wonder', 'عجائب الشتاء', 'A seasonal snowy adventure.', 'مغامرة شتوية موسمية.', ['nature-mountain'], null, false, 'winter'),
];
