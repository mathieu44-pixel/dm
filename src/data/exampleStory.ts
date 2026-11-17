import type { Character, Story } from './types'

/**
 * Histoire d'exemple originale, installée au premier lancement pour pouvoir tester tout de suite.
 * Identifiants fixes : on peut la réinstaller sans créer de doublon.
 */

export const EXAMPLE_STORY_ID = 'example-gue-aux-corbeaux'

const T = 0 // dates figées : l'exemple n'est jamais « récent »

export const EXAMPLE_CHARACTERS: Character[] = [
  {
    id: 'example-maelle',
    name: 'Maëlle Vautrin',
    title: "Aubergiste du Gué-aux-Corbeaux",
    appearance: 'Quarantaine, carrure solide, cheveux gris tirés en arrière, une cicatrice pâle du menton à l\'oreille.',
    personality: 'Bourrue, pragmatique, protectrice envers ses clients réguliers. Méfiante envers les inconnus mais juste.',
    speech: 'Phrases courtes, tutoie tout le monde, jure par « les sept rivières ».',
    background: "Ancienne sergente des Lames Grises, une compagnie mercenaire dissoute après une trahison qu'elle refuse d'évoquer. A racheté l'auberge il y a dix ans.",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'example-anselme',
    name: 'Frère Anselme',
    title: 'Moine itinérant',
    appearance: 'Maigre, robe de bure trempée, mains fines de lettré, regard qui s\'attarde trop longtemps.',
    personality: 'Doux en apparence, curieux, pose beaucoup de questions. Cache quelque chose.',
    speech: 'Vouvoie, cite des proverbes religieux, parle bas.',
    background: "Prétend se rendre au monastère de Saint-Aubert. En réalité, il cherche la lettre scellée que transporte Isolde.",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'example-isolde',
    name: 'Isolde Garance',
    title: 'Coursière de la Guilde des Postes',
    appearance: 'Vingt-cinq ans, cape de cuir huilé, sacoche serrée contre elle, cheveux roux coupés court.',
    personality: 'Vive, nerveuse, fière de son métier, ne fait confiance à personne cette nuit.',
    speech: 'Parle vite, ironique quand elle a peur.',
    background: "Doit remettre une lettre scellée au comte de Vauclair avant trois jours. Elle ignore ce qu'elle contient, mais quelqu'un l'a suivie depuis la ville.",
    createdAt: T,
    updatedAt: T,
  },
]

export const EXAMPLE_STORY: Story = {
  id: EXAMPLE_STORY_ID,
  title: 'Le Gué-aux-Corbeaux',
  subtitle: "Une nuit d'orage, une auberge isolée, une lettre que quelqu'un veut à tout prix.",
  tags: ['Fantasy', 'Mystère', 'Huis clos'],
  mode: 'story',
  worldLore: [
    "Le royaume de Vauclair, monde médiéval-fantastique à basse magie. La magie existe mais elle est rare, crainte et surveillée par l'Ordre des Veilleurs.",
    "Le Gué-aux-Corbeaux est une auberge isolée au bord de la rivière Morne, sur la route entre la ville portuaire de Saint-Lys et le château du comte de Vauclair. Quand la rivière déborde, le gué devient infranchissable et les voyageurs restent bloqués.",
    "Cette nuit, un orage violent a fait monter les eaux. Personne ne repartira avant l'aube.",
    "Lieux : la salle commune (cheminée, longues tables), les chambres à l'étage, l'écurie, la cave à vin, le gué.",
    "Rumeur : des corbeaux se posent sur le toit chaque fois qu'un mort se prépare.",
  ].join('\n'),
  systemPrompt: [
    "Tu es la narratrice d'une histoire interactive. Le joueur incarne son propre personnage, qui vient d'arriver à l'auberge.",
    "Fais vivre les personnages avec leurs secrets. Laisse le joueur mener l'enquête : ne révèle pas tout d'un coup, distille des indices.",
    "La tension monte au fil de la nuit : bruits étranges, disparition d'un objet, quelqu'un qui rôde dans l'écurie.",
    "Les choix du joueur ont des conséquences réelles.",
  ].join('\n'),
  writingRules: 'Ton sombre et feutré, atmosphère de huis clos. Descriptions sensorielles (pluie, feu, odeurs). Dialogues vifs.',
  characterIds: EXAMPLE_CHARACTERS.map((c) => c.id),
  startSettings: [
    {
      id: 'example-start',
      name: "L'arrivée sous l'orage",
      prologue: [
        "「La pluie te fouette le visage depuis des heures quand une lueur apparaît enfin entre les arbres. Une enseigne grince au vent : un corbeau peint, aux ailes écaillées. Derrière toi, la rivière Morne gronde comme une bête.」",
        "「Tu pousses la porte. La chaleur de la salle commune te saisit. Trois visages se tournent vers toi : une femme massive derrière le comptoir, un moine trempé près du feu, et une jeune femme rousse qui serre une sacoche contre elle.」",
        'Maëlle Vautrin | "Ferme la porte, tu fais entrer l\'orage. Le gué est noyé, alors si tu comptais repartir cette nuit, oublie."',
        "「Sur le toit, un corbeau croasse. Puis un deuxième.」",
      ].join('\n'),
      initialSuggestions: [
        'Je demande une chambre et un repas chaud.',
        "Je m'assieds près du feu, à côté du moine.",
        'J\'observe discrètement la jeune femme à la sacoche.',
      ],
      stats: [
        {
          id: 'example-stat-maelle',
          name: 'Confiance de Maëlle',
          icon: '🍺',
          color: '#e8b04b',
          min: 0,
          max: 100,
          initial: 30,
          levels: { low: 'méfiante', mid: 'neutre', high: 'alliée' },
          rulesText: "Monte quand le joueur est honnête, aide à l'auberge ou protège ses clients. Baisse s'il ment, fouille ou menace.",
        },
        {
          id: 'example-stat-isolde',
          name: "Confiance d'Isolde",
          icon: '✉️',
          color: '#e86f5f',
          min: 0,
          max: 100,
          initial: 10,
          levels: { low: 'sur ses gardes', mid: 'hésitante', high: 'confiante' },
          rulesText: "Monte quand le joueur la protège ou partage des informations. Baisse s'il s'intéresse trop à sa sacoche.",
        },
        {
          id: 'example-stat-indices',
          name: 'Indices',
          icon: '🔎',
          color: '#5fa8e8',
          min: 0,
          max: 10,
          initial: 0,
          levels: { low: 'brouillard', mid: 'pistes', high: 'presque tout' },
          rulesText: "+1 chaque fois que le joueur découvre un élément concret sur le secret de Frère Anselme ou sur la lettre.",
        },
        {
          id: 'example-stat-danger',
          name: 'Danger',
          icon: '🌩️',
          color: '#c27be8',
          min: 0,
          max: 100,
          initial: 20,
          levels: { low: 'calme', mid: 'tendu', high: 'mortel' },
          rulesText: "Monte avec le temps qui passe, les confrontations et quand Frère Anselme se sent démasqué. Baisse si le joueur désamorce un conflit.",
        },
      ],
      endings: [
        {
          id: 'example-end-lettre',
          name: 'La lettre sauvée',
          rarity: 'SSR',
          cardText: 'Le complot est déjoué avant l\'aube.',
          epilogue:
            "「À l'aube, la Morne redescend enfin. Isolde franchit le gué, la lettre intacte contre son cœur, et se retourne une dernière fois vers toi. Derrière vous, Frère Anselme est ligoté dans la cave, sous l'œil sévère de Maëlle. Sur le toit, les corbeaux se sont tus.」\n\n「Trois jours plus tard, un messager du comte de Vauclair s'arrête au Gué-aux-Corbeaux. Il demande ton nom.」",
          condition: {
            op: 'AND',
            items: [
              { type: 'stat', statId: 'example-stat-indices', cmp: '>=', value: 6 },
              { type: 'stat', statId: 'example-stat-isolde', cmp: '>=', value: 60 },
            ],
          },
        },
        {
          id: 'example-end-sang',
          name: 'Nuit rouge',
          rarity: 'R',
          cardText: 'Quelqu\'un ne verra pas le jour se lever.',
          epilogue:
            "「Le cri déchire la nuit. Quand tu descends l'escalier, la salle commune est vide et la porte bat au vent. Sur la table, la sacoche éventrée. Dehors, sept corbeaux attendent sur la clôture.」",
          condition: { op: 'AND', items: [{ type: 'stat', statId: 'example-stat-danger', cmp: '>=', value: 90 }] },
        },
        {
          id: 'example-end-chambre',
          name: 'Une nuit tranquille',
          rarity: 'N',
          cardText: "Tu as dormi. D'autres, non.",
          epilogue:
            "「Tu te réveilles sous un ciel lavé. Le gué est praticable, l'auberge silencieuse. Maëlle te tend un bol de soupe sans un mot. Ni le moine ni la coursière ne sont plus là. Tu ne sauras jamais ce que contenait la lettre.」",
          condition: { op: 'AND', items: [{ type: 'turn', gte: 40 }] },
        },
      ],
    },
  ],
  isExample: true,
  createdAt: T,
  updatedAt: T,
}
