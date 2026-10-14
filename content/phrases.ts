import type { LearningLanguage, StageNumber } from '@/types/core';
import type { Phrase, TopicId } from '@/types/content';

type Texts = Record<LearningLanguage, string>;
interface PhraseRow {
  id: string;
  topic: TopicId;
  stage: StageNumber;
  gloss: { en: string; ar: string };
  t: Texts;
  concepts?: string[];
  pattern?: string;
  /** Extra accepted spoken variants per language */
  alt?: Partial<Record<LearningLanguage, string[]>>;
}

const P: PhraseRow[] = [
  // greetings & social
  { id: 'greet.whats_your_name', topic: 'greetings', stage: 1, gloss: { en: "What's your name?", ar: 'ما اسمك؟' },
    t: { en: "What's your name?", fr: "Comment tu t'appelles ?", de: 'Wie heißt du?', it: 'Come ti chiami?', es: '¿Cómo te llamas?' } },
  { id: 'greet.my_name_is', topic: 'greetings', stage: 1, gloss: { en: 'My name is…', ar: 'اسمي…' },
    t: { en: 'My name is', fr: "Je m'appelle", de: 'Ich heiße', it: 'Mi chiamo', es: 'Me llamo' },
    alt: { en: ["I'm", 'I am'], de: ['Ich bin', 'Mein Name ist'], es: ['Soy', 'Mi nombre es'], it: ['Sono', 'Il mio nome è'], fr: ['Je suis', 'Moi c’est'] } },
  { id: 'greet.how_are_you', topic: 'greetings', stage: 1, gloss: { en: 'How are you?', ar: 'كيف حالك؟' },
    t: { en: 'How are you?', fr: 'Comment ça va ?', de: "Wie geht's?", it: 'Come stai?', es: '¿Cómo estás?' } },
  { id: 'greet.im_fine', topic: 'greetings', stage: 1, gloss: { en: "I'm fine, thank you.", ar: 'أنا بخير، شكرًا.' },
    t: { en: "I'm fine, thank you.", fr: 'Ça va bien, merci.', de: "Mir geht's gut, danke.", it: 'Sto bene, grazie.', es: 'Estoy bien, gracias.' },
    concepts: ['greetings.thanks'], alt: { en: ["I'm fine", 'fine thanks', "I'm good"], fr: ['ça va', 'bien merci'], de: ['gut danke', 'gut'], it: ['bene grazie', 'bene'], es: ['bien gracias', 'bien'] } },
  { id: 'greet.see_you_tomorrow', topic: 'greetings', stage: 1, gloss: { en: 'See you tomorrow!', ar: 'أراك غدًا!' },
    t: { en: 'See you tomorrow!', fr: 'À demain !', de: 'Bis morgen!', it: 'A domani!', es: '¡Hasta mañana!' }, concepts: ['time.tomorrow'] },
  { id: 'greet.lets_go', topic: 'greetings', stage: 1, gloss: { en: "Let's go!", ar: 'هيا بنا!' },
    t: { en: "Let's go!", fr: 'On y va !', de: "Los geht's!", it: 'Andiamo!', es: '¡Vamos!' } },
  { id: 'greet.well_done', topic: 'greetings', stage: 1, gloss: { en: 'Well done!', ar: 'أحسنت!' },
    t: { en: 'Well done!', fr: 'Bravo !', de: 'Super gemacht!', it: 'Bravo!', es: '¡Muy bien!' } },
  { id: 'greet.help_me', topic: 'greetings', stage: 2, gloss: { en: 'Can you help me?', ar: 'هل يمكنك مساعدتي؟' },
    t: { en: 'Can you help me?', fr: 'Tu peux m’aider ?', de: 'Kannst du mir helfen?', it: 'Mi puoi aiutare?', es: '¿Me puedes ayudar?' } },
  { id: 'greet.yes_please', topic: 'greetings', stage: 1, gloss: { en: 'Yes, please!', ar: 'نعم، من فضلك!' },
    t: { en: 'Yes, please!', fr: "Oui, s'il te plaît !", de: 'Ja, bitte!', it: 'Sì, per favore!', es: '¡Sí, por favor!' }, concepts: ['greetings.yes', 'greetings.please'] },

  // feelings (gender-neutral constructions — we never ask a child's gender)
  { id: 'feel.i_feel_good', topic: 'feelings', stage: 2, gloss: { en: 'I feel good.', ar: 'أشعر بخير.' },
    t: { en: 'I feel good.', fr: 'Je me sens bien.', de: 'Mir geht es gut.', it: 'Sto bene.', es: 'Me siento bien.' } },
  { id: 'feel.hungry', topic: 'feelings', stage: 2, gloss: { en: "I'm hungry.", ar: 'أنا جائع.' },
    t: { en: "I'm hungry.", fr: "J'ai faim.", de: 'Ich habe Hunger.', it: 'Ho fame.', es: 'Tengo hambre.' } },
  { id: 'feel.thirsty', topic: 'feelings', stage: 2, gloss: { en: "I'm thirsty.", ar: 'أنا عطشان.' },
    t: { en: "I'm thirsty.", fr: "J'ai soif.", de: 'Ich habe Durst.', it: 'Ho sete.', es: 'Tengo sed.' } },
  { id: 'feel.scared', topic: 'feelings', stage: 2, gloss: { en: "I'm scared.", ar: 'أنا خائف.' },
    t: { en: "I'm scared.", fr: "J'ai peur.", de: 'Ich habe Angst.', it: 'Ho paura.', es: 'Tengo miedo.' }, concepts: ['feelings.scared'] },
  { id: 'feel.sleepy', topic: 'feelings', stage: 2, gloss: { en: "I'm sleepy.", ar: 'أنا نعسان.' },
    t: { en: "I'm sleepy.", fr: "J'ai sommeil.", de: 'Ich bin müde.', it: 'Ho sonno.', es: 'Tengo sueño.' }, concepts: ['feelings.tired'] },

  // routine
  { id: 'routine.wake_up', topic: 'routine', stage: 2, gloss: { en: 'I wake up.', ar: 'أستيقظ.' },
    t: { en: 'I wake up.', fr: 'Je me réveille.', de: 'Ich wache auf.', it: 'Mi sveglio.', es: 'Me despierto.' }, concepts: ['routine.morning'] },
  { id: 'routine.brush_teeth', topic: 'routine', stage: 2, gloss: { en: 'I brush my teeth.', ar: 'أنظف أسناني.' },
    t: { en: 'I brush my teeth.', fr: 'Je me brosse les dents.', de: 'Ich putze mir die Zähne.', it: 'Mi lavo i denti.', es: 'Me lavo los dientes.' }, concepts: ['body.tooth', 'routine.toothbrush'] },
  { id: 'routine.eat_breakfast', topic: 'routine', stage: 2, gloss: { en: 'I eat breakfast.', ar: 'أتناول الفطور.' },
    t: { en: 'I eat breakfast.', fr: 'Je prends le petit-déjeuner.', de: 'Ich frühstücke.', it: 'Faccio colazione.', es: 'Desayuno.' }, concepts: ['routine.breakfast'] },
  { id: 'routine.go_to_school', topic: 'routine', stage: 2, gloss: { en: 'I go to school.', ar: 'أذهب إلى المدرسة.' },
    t: { en: 'I go to school.', fr: "Je vais à l'école.", de: 'Ich gehe zur Schule.', it: 'Vado a scuola.', es: 'Voy a la escuela.' }, concepts: ['school.school'] },
  { id: 'routine.go_to_bed', topic: 'routine', stage: 2, gloss: { en: 'I go to bed.', ar: 'أذهب إلى السرير.' },
    t: { en: 'I go to bed.', fr: 'Je vais au lit.', de: 'Ich gehe ins Bett.', it: 'Vado a letto.', es: 'Me voy a la cama.' }, concepts: ['home.bed'] },

  // directions (also voice commands that move characters)
  { id: 'dir.go_left', topic: 'directions', stage: 2, gloss: { en: 'Go left!', ar: 'اذهب يسارًا!' },
    t: { en: 'Go left!', fr: 'Va à gauche !', de: 'Geh nach links!', it: 'Vai a sinistra!', es: '¡Ve a la izquierda!' }, concepts: ['directions.left'],
    alt: { en: ['left', 'turn left'], fr: ['à gauche', 'gauche'], de: ['links', 'nach links'], it: ['sinistra', 'a sinistra'], es: ['izquierda', 'a la izquierda'] } },
  { id: 'dir.go_right', topic: 'directions', stage: 2, gloss: { en: 'Go right!', ar: 'اذهب يمينًا!' },
    t: { en: 'Go right!', fr: 'Va à droite !', de: 'Geh nach rechts!', it: 'Vai a destra!', es: '¡Ve a la derecha!' }, concepts: ['directions.right'],
    alt: { en: ['right', 'turn right'], fr: ['à droite', 'droite'], de: ['rechts', 'nach rechts'], it: ['destra', 'a destra'], es: ['derecha', 'a la derecha'] } },
  { id: 'dir.go_straight', topic: 'directions', stage: 3, gloss: { en: 'Go straight on!', ar: 'اذهب إلى الأمام!' },
    t: { en: 'Go straight on!', fr: 'Va tout droit !', de: 'Geh geradeaus!', it: 'Vai dritto!', es: '¡Sigue recto!' }, concepts: ['directions.straight'],
    alt: { en: ['straight', 'go straight', 'forward'], fr: ['tout droit'], de: ['geradeaus'], it: ['dritto', 'avanti'], es: ['recto', 'derecho', 'adelante'] } },
  { id: 'dir.go_up', topic: 'directions', stage: 2, gloss: { en: 'Go up!', ar: 'اصعد!' },
    t: { en: 'Go up!', fr: 'Monte !', de: 'Geh nach oben!', it: 'Vai su!', es: '¡Sube!' }, concepts: ['directions.up'],
    alt: { en: ['up'], fr: ['en haut', 'monte'], de: ['oben', 'nach oben', 'hoch'], it: ['su'], es: ['arriba', 'sube'] } },
  { id: 'dir.go_down', topic: 'directions', stage: 2, gloss: { en: 'Go down!', ar: 'انزل!' },
    t: { en: 'Go down!', fr: 'Descends !', de: 'Geh nach unten!', it: 'Vai giù!', es: '¡Baja!' }, concepts: ['directions.down'],
    alt: { en: ['down'], fr: ['en bas', 'descends'], de: ['unten', 'nach unten', 'runter'], it: ['giù'], es: ['abajo', 'baja'] } },
  { id: 'dir.stop', topic: 'directions', stage: 2, gloss: { en: 'Stop!', ar: 'قف!' },
    t: { en: 'Stop!', fr: 'Stop !', de: 'Halt!', it: 'Fermati!', es: '¡Para!' }, alt: { fr: ['arrête'], de: ['stopp', 'stop'], it: ['stop', 'ferma'], es: ['alto', 'stop'] } },
  { id: 'dir.open_door', topic: 'directions', stage: 2, gloss: { en: 'Open the door!', ar: 'افتح الباب!' },
    t: { en: 'Open the door!', fr: 'Ouvre la porte !', de: 'Mach die Tür auf!', it: 'Apri la porta!', es: '¡Abre la puerta!' }, concepts: ['home.door', 'actions.open'],
    alt: { de: ['Öffne die Tür'] } },
  { id: 'dir.follow_me', topic: 'directions', stage: 2, gloss: { en: 'Follow me!', ar: 'اتبعني!' },
    t: { en: 'Follow me!', fr: 'Suis-moi !', de: 'Folge mir!', it: 'Seguimi!', es: '¡Sígueme!' } },

  // questions
  { id: 'q.what_is_this', topic: 'questions', stage: 2, gloss: { en: 'What is this?', ar: 'ما هذا؟' },
    t: { en: 'What is this?', fr: "Qu'est-ce que c'est ?", de: 'Was ist das?', it: "Che cos'è?", es: '¿Qué es esto?' }, concepts: ['questions.what'] },
  { id: 'q.how_many', topic: 'questions', stage: 2, gloss: { en: 'How many?', ar: 'كم؟' },
    t: { en: 'How many?', fr: 'Combien ?', de: 'Wie viele?', it: 'Quanti?', es: '¿Cuántos?' }, concepts: ['questions.how_many'] },
  { id: 'q.what_color', topic: 'questions', stage: 2, gloss: { en: 'What colour is it?', ar: 'ما لونه؟' },
    t: { en: 'What colour is it?', fr: "C'est de quelle couleur ?", de: 'Welche Farbe hat es?', it: 'Di che colore è?', es: '¿De qué color es?' } },
  { id: 'q.how_old', topic: 'questions', stage: 3, gloss: { en: 'How old are you?', ar: 'كم عمرك؟' },
    t: { en: 'How old are you?', fr: 'Quel âge as-tu ?', de: 'Wie alt bist du?', it: 'Quanti anni hai?', es: '¿Cuántos años tienes?' } },
  { id: 'q.do_you_like_it', topic: 'questions', stage: 2, gloss: { en: 'Do you like it?', ar: 'هل يعجبك؟' },
    t: { en: 'Do you like it?', fr: 'Tu aimes ça ?', de: 'Magst du das?', it: 'Ti piace?', es: '¿Te gusta?' } },
  { id: 'q.i_like_it', topic: 'questions', stage: 2, gloss: { en: 'I like it!', ar: 'يعجبني!' },
    t: { en: 'I like it!', fr: "J'aime ça !", de: 'Das mag ich!', it: 'Mi piace!', es: '¡Me gusta!' }, alt: { de: ['Ich mag das'], fr: ["j'adore"] } },
  { id: 'q.where_is_it', topic: 'questions', stage: 2, gloss: { en: 'Where is it?', ar: 'أين هو؟' },
    t: { en: 'Where is it?', fr: 'Où est-ce ?', de: 'Wo ist es?', it: "Dov'è?", es: '¿Dónde está?' }, concepts: ['questions.where'] },

  // weather
  { id: 'weather.sunny', topic: 'weather', stage: 2, gloss: { en: 'It is sunny.', ar: 'الجو مشمس.' },
    t: { en: 'It is sunny.', fr: 'Il fait beau.', de: 'Es ist sonnig.', it: "C'è il sole.", es: 'Hace sol.' }, concepts: ['weather.sun'], alt: { en: ["It's sunny"] } },
  { id: 'weather.raining', topic: 'weather', stage: 2, gloss: { en: 'It is raining.', ar: 'إنها تمطر.' },
    t: { en: 'It is raining.', fr: 'Il pleut.', de: 'Es regnet.', it: 'Piove.', es: 'Llueve.' }, concepts: ['weather.rain'], alt: { en: ["It's raining"], es: ['Está lloviendo'] } },
  { id: 'weather.cold', topic: 'weather', stage: 2, gloss: { en: 'It is cold.', ar: 'الجو بارد.' },
    t: { en: 'It is cold.', fr: 'Il fait froid.', de: 'Es ist kalt.', it: 'Fa freddo.', es: 'Hace frío.' }, concepts: ['weather.cold'], alt: { en: ["It's cold"] } },
  { id: 'weather.hot', topic: 'weather', stage: 2, gloss: { en: 'It is hot.', ar: 'الجو حار.' },
    t: { en: 'It is hot.', fr: 'Il fait chaud.', de: 'Es ist heiß.', it: 'Fa caldo.', es: 'Hace calor.' }, concepts: ['weather.hot'], alt: { en: ["It's hot"] } },
  { id: 'weather.snowing', topic: 'weather', stage: 2, gloss: { en: 'It is snowing.', ar: 'إنها تثلج.' },
    t: { en: 'It is snowing.', fr: 'Il neige.', de: 'Es schneit.', it: 'Nevica.', es: 'Nieva.' }, concepts: ['weather.snow'], alt: { en: ["It's snowing"], es: ['Está nevando'] } },

  // shopping
  { id: 'shop.how_much', topic: 'shopping', stage: 4, gloss: { en: 'How much is it?', ar: 'بكم هذا؟' },
    t: { en: 'How much is it?', fr: "C'est combien ?", de: 'Wie viel kostet das?', it: 'Quanto costa?', es: '¿Cuánto cuesta?' }, concepts: ['shopping.price'] },
  { id: 'shop.i_would_like', topic: 'shopping', stage: 3, gloss: { en: 'I would like…', ar: 'أريد…' },
    t: { en: 'I would like', fr: 'Je voudrais', de: 'Ich möchte', it: 'Vorrei', es: 'Quisiera' }, alt: { en: ["I'd like", 'I want'], es: ['Quiero'], it: ['Voglio'], fr: ['Je veux'], de: ['Ich will'] } },
  { id: 'shop.here_you_are', topic: 'shopping', stage: 3, gloss: { en: 'Here you are.', ar: 'تفضل.' },
    t: { en: 'Here you are.', fr: 'Voilà.', de: 'Bitte schön.', it: 'Ecco a te.', es: 'Aquí tienes.' } },
  { id: 'shop.thanks_bye', topic: 'shopping', stage: 3, gloss: { en: 'Thank you, goodbye!', ar: 'شكرًا، مع السلامة!' },
    t: { en: 'Thank you, goodbye!', fr: 'Merci, au revoir !', de: 'Danke, tschüss!', it: 'Grazie, arrivederci!', es: '¡Gracias, adiós!' }, concepts: ['greetings.thanks', 'greetings.goodbye'] },

  // restaurant
  { id: 'rest.table_please', topic: 'restaurant', stage: 4, gloss: { en: 'A table, please.', ar: 'طاولة من فضلك.' },
    t: { en: 'A table, please.', fr: "Une table, s'il vous plaît.", de: 'Einen Tisch, bitte.', it: 'Un tavolo, per favore.', es: 'Una mesa, por favor.' }, concepts: ['home.table', 'greetings.please'] },
  { id: 'rest.what_would_you_like', topic: 'restaurant', stage: 4, gloss: { en: 'What would you like?', ar: 'ماذا تريد؟' },
    t: { en: 'What would you like?', fr: "Qu'est-ce que tu voudrais ?", de: 'Was möchtest du?', it: 'Cosa desideri?', es: '¿Qué quieres?' } },
  { id: 'rest.the_bill', topic: 'restaurant', stage: 4, gloss: { en: 'The bill, please.', ar: 'الحساب من فضلك.' },
    t: { en: 'The bill, please.', fr: "L'addition, s'il vous plaît.", de: 'Die Rechnung, bitte.', it: 'Il conto, per favore.', es: 'La cuenta, por favor.' }, alt: { en: ['the check please'] } },
  { id: 'rest.delicious', topic: 'restaurant', stage: 3, gloss: { en: "It's delicious!", ar: 'إنه لذيذ!' },
    t: { en: "It's delicious!", fr: "C'est délicieux !", de: 'Das ist lecker!', it: 'È buonissimo!', es: '¡Está delicioso!' }, alt: { en: ['yummy', 'delicious'], de: ['lecker'], it: ['buonissimo', 'buono'], es: ['delicioso', 'rico'], fr: ['délicieux', 'miam'] } },
  { id: 'rest.water_please', topic: 'restaurant', stage: 3, gloss: { en: 'Water, please.', ar: 'ماء من فضلك.' },
    t: { en: 'Water, please.', fr: "De l'eau, s'il vous plaît.", de: 'Wasser, bitte.', it: 'Acqua, per favore.', es: 'Agua, por favor.' }, concepts: ['food.water', 'greetings.please'] },

  // travel
  { id: 'travel.my_ticket', topic: 'travel', stage: 4, gloss: { en: 'Here is my ticket.', ar: 'هذه تذكرتي.' },
    t: { en: 'Here is my ticket.', fr: 'Voici mon billet.', de: 'Hier ist meine Fahrkarte.', it: 'Ecco il mio biglietto.', es: 'Aquí está mi billete.' }, concepts: ['travel.ticket'] },
  { id: 'travel.where_are_we_going', topic: 'travel', stage: 4, gloss: { en: 'Where are we going?', ar: 'إلى أين نذهب؟' },
    t: { en: 'Where are we going?', fr: 'Où allons-nous ?', de: 'Wohin gehen wir?', it: 'Dove andiamo?', es: '¿Adónde vamos?' } },
  { id: 'travel.take_the_plane', topic: 'travel', stage: 3, gloss: { en: "Let's take the plane!", ar: 'لنركب الطائرة!' },
    t: { en: "Let's take the plane!", fr: "Prenons l'avion !", de: 'Wir nehmen das Flugzeug!', it: "Prendiamo l'aereo!", es: '¡Tomemos el avión!' }, concepts: ['transport.plane'] },

  // friends, party, doctor, school
  { id: 'friends.want_to_play', topic: 'hobbies', stage: 2, gloss: { en: 'Do you want to play?', ar: 'هل تريد أن تلعب؟' },
    t: { en: 'Do you want to play?', fr: 'Tu veux jouer ?', de: 'Willst du spielen?', it: 'Vuoi giocare?', es: '¿Quieres jugar?' }, concepts: ['actions.play'] },
  { id: 'friends.lets_play', topic: 'hobbies', stage: 2, gloss: { en: "Yes, let's play!", ar: 'نعم، لنلعب!' },
    t: { en: "Yes, let's play!", fr: 'Oui, jouons !', de: 'Ja, lass uns spielen!', it: 'Sì, giochiamo!', es: '¡Sí, juguemos!' }, concepts: ['greetings.yes', 'actions.play'] },
  { id: 'friends.my_friend', topic: 'family', stage: 3, gloss: { en: 'This is my friend.', ar: 'هذا صديقي.' },
    t: { en: 'This is my friend.', fr: "C'est mon ami.", de: 'Das ist mein Freund.', it: 'Questo è il mio amico.', es: 'Este es mi amigo.' }, concepts: ['family.friend'] },
  { id: 'party.happy_birthday', topic: 'calendar', stage: 2, gloss: { en: 'Happy birthday!', ar: 'عيد ميلاد سعيد!' },
    t: { en: 'Happy birthday!', fr: 'Joyeux anniversaire !', de: 'Alles Gute zum Geburtstag!', it: 'Buon compleanno!', es: '¡Feliz cumpleaños!' }, concepts: ['calendar.birthday'] },
  { id: 'doctor.head_hurts', topic: 'body', stage: 4, gloss: { en: 'My head hurts.', ar: 'رأسي يؤلمني.' },
    t: { en: 'My head hurts.', fr: "J'ai mal à la tête.", de: 'Mein Kopf tut weh.', it: 'Mi fa male la testa.', es: 'Me duele la cabeza.' }, concepts: ['body.head'] },
  { id: 'doctor.feel_better', topic: 'body', stage: 4, gloss: { en: 'I feel better.', ar: 'أشعر بتحسن.' },
    t: { en: 'I feel better.', fr: 'Je me sens mieux.', de: 'Mir geht es besser.', it: 'Mi sento meglio.', es: 'Me siento mejor.' } },
  { id: 'school.dont_understand', topic: 'school', stage: 3, gloss: { en: "I don't understand.", ar: 'لا أفهم.' },
    t: { en: "I don't understand.", fr: 'Je ne comprends pas.', de: 'Ich verstehe das nicht.', it: 'Non capisco.', es: 'No entiendo.' } },
  { id: 'school.repeat_please', topic: 'school', stage: 3, gloss: { en: 'Can you repeat, please?', ar: 'هل يمكنك التكرار من فضلك؟' },
    t: { en: 'Can you repeat, please?', fr: "Tu peux répéter, s'il te plaît ?", de: 'Kannst du das wiederholen, bitte?', it: 'Puoi ripetere, per favore?', es: '¿Puedes repetir, por favor?' } },

  // story phrases
  { id: 'story.look', topic: 'actions', stage: 1, gloss: { en: 'Look!', ar: 'انظر!' },
    t: { en: 'Look!', fr: 'Regarde !', de: 'Schau mal!', it: 'Guarda!', es: '¡Mira!' }, concepts: ['actions.look'] },
  { id: 'story.golden_key', topic: 'adventure', stage: 1, gloss: { en: 'A golden key!', ar: 'مفتاح ذهبي!' },
    t: { en: 'A golden key!', fr: 'Une clé dorée !', de: 'Ein goldener Schlüssel!', it: "Una chiave d'oro!", es: '¡Una llave dorada!' }, concepts: ['home.key', 'colors.golden'] },
  { id: 'story.found_it', topic: 'adventure', stage: 1, gloss: { en: 'Found it!', ar: 'وجدته!' },
    t: { en: 'Found it!', fr: 'Trouvé !', de: 'Gefunden!', it: 'Trovato!', es: '¡Lo encontré!' }, alt: { en: ['I found it'], fr: ["Je l'ai trouvé"], de: ['Ich hab’s gefunden'], it: ["L'ho trovato"] } },
  { id: 'story.be_careful', topic: 'adventure', stage: 2, gloss: { en: 'Be careful!', ar: 'انتبه!' },
    t: { en: 'Be careful!', fr: 'Attention !', de: 'Vorsicht!', it: 'Attenzione!', es: '¡Cuidado!' } },
  { id: 'story.what_happened', topic: 'adventure', stage: 3, gloss: { en: 'What happened?', ar: 'ماذا حدث؟' },
    t: { en: 'What happened?', fr: "Qu'est-ce qui s'est passé ?", de: 'Was ist passiert?', it: "Cos'è successo?", es: '¿Qué pasó?' } },
  { id: 'story.good_night_mimo', topic: 'routine', stage: 1, gloss: { en: 'Good night!', ar: 'تصبح على خير!' },
    t: { en: 'Good night!', fr: 'Bonne nuit !', de: 'Gute Nacht!', it: 'Buonanotte!', es: '¡Buenas noches!' }, concepts: ['greetings.good_night'] },
  { id: 'story.hello_friend', topic: 'greetings', stage: 1, gloss: { en: 'Hello, friend!', ar: 'مرحبًا يا صديقي!' },
    t: { en: 'Hello, friend!', fr: 'Bonjour, mon ami !', de: 'Hallo, Freund!', it: 'Ciao, amico!', es: '¡Hola, amigo!' }, concepts: ['greetings.hello', 'family.friend'] },
];

export function buildPhrases(): Phrase[] {
  const out: Phrase[] = [];
  for (const row of P) {
    for (const lang of Object.keys(row.t) as LearningLanguage[]) {
      out.push({
        id: row.id,
        language: lang,
        text: row.t[lang],
        gloss: { en: row.gloss.en, ar: row.gloss.ar },
        topic: row.topic,
        conceptIds: row.concepts ?? [],
        grammarPatternId: row.pattern,
        cefr: row.stage <= 2 ? 'preA1' : row.stage <= 4 ? 'A1' : 'A2',
        stage: row.stage,
        acceptedVariants: row.alt?.[lang],
      });
    }
  }
  return out;
}

export const PHRASE_IDS = P.map((p) => p.id);
