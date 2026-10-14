import { describe, expect, it } from 'vitest';
import { getContentIndex } from '@/content';
import { GrammarRealizer, contract, englishIndefinite } from '@/curriculum/grammar';

const r = new GrammarRealizer(getContentIndex());

describe('GrammarRealizer', () => {
  it('builds the canonical review sentence in all five languages', () => {
    const slots = { subject: { noun: 'animals.elephant', adjectives: ['colors.yellow'] }, prep: 'directions.under', object: { noun: 'home.bridge' } };
    expect(r.realize('en', 'location', slots)).toBe('The yellow elephant is under the bridge.');
    expect(r.realize('fr', 'location', slots)).toBe("L'éléphant jaune est sous le pont.");
    expect(r.realize('de', 'location', slots)).toBe('Der gelbe Elefant ist unter der Brücke.');
    expect(r.realize('it', 'location', slots)).toBe("L'elefante giallo è sotto il ponte.");
    expect(r.realize('es', 'location', slots)).toBe('El elefante amarillo está debajo del puente.');
  });

  it('handles German cases and adjective endings', () => {
    expect(r.realize('de', 'i-see', { subject: { noun: 'animals.dog', adjectives: ['descriptions.big'] } })).toBe('Ich sehe einen großen Hund.');
    expect(r.nounPhrase('de', { noun: 'home.bed', adjectives: ['descriptions.big', 'colors.blue'] })).toBe('ein großes blaues Bett');
    expect(r.realize('de', 'location', { subject: { noun: 'animals.cat' }, prep: 'directions.in', object: { noun: 'home.house' } })).toBe('Die Katze ist im Haus.');
    expect(r.nounPhrase('de', { noun: 'clothing.dress', adjectives: ['colors.purple'] })).toBe('ein lila Kleid');
  });

  it('handles French elision, pre-nominal adjectives and contractions', () => {
    expect(r.nounPhrase('fr', { noun: 'travel.airport', adjectives: ['descriptions.old'] })).toBe('un vieil aéroport');
    expect(r.nounPhrase('fr', { noun: 'animals.elephant', adjectives: ['descriptions.small'], det: 'def' })).toBe('le petit éléphant');
    expect(r.cardLabel('animals.owl', 'fr')).toBe('le hibou');
    expect(r.realize('fr', 'location', { subject: { noun: 'animals.cat' }, prep: 'directions.next_to', object: { noun: 'animals.dog' } })).toBe('Le chat est à côté du chien.');
  });

  it('handles Italian articles (lo, l\', un\') and contractions', () => {
    expect(r.cardLabel('school.schoolbag', 'it')).toBe('lo zaino');
    expect(r.nounPhrase('it', { noun: 'nature.island' })).toBe("un'isola");
    expect(r.realize('it', 'location', { subject: { noun: 'animals.cat' }, prep: 'directions.in', object: { noun: 'home.box' } })).toBe('Il gatto è nella scatola.');
    expect(contract('it', 'accanto a', 'il cane')).toBe('accanto al cane');
  });

  it('handles Spanish punctuation, agreement and el agua', () => {
    expect(r.realize('es', 'where-is', { subject: { noun: 'home.door', adjectives: ['colors.golden'] } })).toBe('¿Dónde está la puerta dorada?');
    expect(r.cardLabel('food.water', 'es')).toBe('el agua');
    expect(r.realize('es', 'is-adjective', { subject: { noun: 'clothing.scarf' }, predicate: 'descriptions.long' })).toBe('La bufanda es larga.');
  });

  it('chooses a/an by the following word and avoids "a water"', () => {
    expect(englishIndefinite('apple')).toBe('an');
    expect(englishIndefinite('red apple')).toBe('a');
    expect(englishIndefinite('hour')).toBe('an');
    expect(englishIndefinite('unicorn')).toBe('a');
    expect(r.realize('en', 'this-is', { subject: { noun: 'food.water' } })).toBe('This is the water.');
    expect(r.realize('en', 'i-have', { subject: { noun: 'food.apple', adjectives: ['colors.red'] } })).toBe('I have a red apple.');
  });
});
