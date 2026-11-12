// Classification verified against the WoRMS REST API on 2026-11-12.
// These are scientific prototypes; gameplay traits and specimen values are fiction.
// Rank names follow WoRMS, including Teleostei and the revised Octocorallia orders.
export const TAXONOMY_NOTE = '学名与分类依据现实原型，游戏别名、配色、相遇区间和共鸣能力采用科幻化设计。';
export const TAXONOMY_SOURCES = [
  { name: 'WoRMS · 海洋物种名录', url: 'https://www.marinespecies.org/', checkedAt: '2026-11-12' },
  { name: 'MBARI · 深海动物资料', url: 'https://www.mbari.org/education/animals-of-the-deep/', checkedAt: '2026-11-12' },
  { name: 'Smithsonian · 海洋动物资料', url: 'https://ocean.si.edu/ocean-life/invertebrates/grimpoteuthis-dumbo-octopus', checkedAt: '2026-11-12' },
];
const PHYLUM_NAMES = {
  Chordata: '脊索动物门', Cnidaria: '刺胞动物门', Mollusca: '软体动物门',
  Arthropoda: '节肢动物门', Echinodermata: '棘皮动物门', Ctenophora: '栉水母动物门',
};
const CLASS_NAMES = {
  Teleostei: '真骨鱼类', Elasmobranchii: '板鳃类', Scyphozoa: '钵水母纲',
  Hydrozoa: '水螅纲', Octocorallia: '八放珊瑚纲', Cephalopoda: '头足纲',
  Gastropoda: '腹足纲', Malacostraca: '软甲纲', Holothuroidea: '海参纲',
  Crinoidea: '海百合纲', Asteroidea: '海星纲', Tentaculata: '有触手纲',
};
const GROUPS = {
  Teleostei: '辐鳍鱼类', Elasmobranchii: '软骨鱼类', Scyphozoa: '钵水母',
  Hydrozoa: '水螅类', Octocorallia: '八放珊瑚', Cephalopoda: '头足类',
  Gastropoda: '腹足类', Malacostraca: '甲壳类', Holothuroidea: '棘皮动物',
  Crinoidea: '棘皮动物', Asteroidea: '棘皮动物', Tentaculata: '栉水母',
};
// [accepted name, AphiaID, phylum, class, order, family, genus, rank]
const RECORDS = [
  [
    "Coryphopterus hyalinus",
    276429,
    "Chordata",
    "Teleostei",
    "Gobiiformes",
    "Gobiidae",
    "Coryphopterus",
    "species"
  ],
  [
    "Pseudanthias squamipinnis",
    218278,
    "Chordata",
    "Teleostei",
    "Perciformes",
    "Anthiadidae",
    "Pseudanthias",
    "species"
  ],
  [
    "Aurelia aurita",
    135306,
    "Cnidaria",
    "Scyphozoa",
    "Semaeostomeae",
    "Ulmaridae",
    "Aurelia",
    "species"
  ],
  [
    "Nemichthys scolopaceus",
    126306,
    "Chordata",
    "Teleostei",
    "Anguilliformes",
    "Nemichthyidae",
    "Nemichthys",
    "species"
  ],
  [
    "Myctophum punctatum",
    126627,
    "Chordata",
    "Teleostei",
    "Myctophiformes",
    "Myctophidae",
    "Myctophum",
    "species"
  ],
  [
    "Insigniteuthis albatrossi",
    1813559,
    "Mollusca",
    "Cephalopoda",
    "Octopoda",
    "Opisthoteuthidae",
    "Insigniteuthis",
    "species"
  ],
  [
    "Acanthephyra purpurea",
    107582,
    "Arthropoda",
    "Malacostraca",
    "Decapoda",
    "Acanthephyridae",
    "Acanthephyra",
    "species"
  ],
  [
    "Crossota millsae",
    285347,
    "Cnidaria",
    "Hydrozoa",
    "Trachymedusae",
    "Rhopalonematidae",
    "Crossota",
    "species"
  ],
  [
    "Vampyroteuthis infernalis",
    141887,
    "Mollusca",
    "Cephalopoda",
    "Vampyromorpha",
    "Vampyroteuthidae",
    "Vampyroteuthis",
    "species"
  ],
  [
    "Eurypharynx pelecanoides",
    127165,
    "Chordata",
    "Teleostei",
    "Anguilliformes",
    "Eurypharyngidae",
    "Eurypharynx",
    "species"
  ],
  [
    "Bathyraja richardsoni",
    105867,
    "Chordata",
    "Elasmobranchii",
    "Rajiformes",
    "Arhynchobatidae",
    "Bathyraja",
    "species"
  ],
  [
    "Praya dubia",
    135466,
    "Cnidaria",
    "Hydrozoa",
    "Siphonophorae",
    "Prayidae",
    "Praya",
    "species"
  ],
  [
    "Kiwa hirsuta",
    249751,
    "Arthropoda",
    "Malacostraca",
    "Decapoda",
    "Kiwaidae",
    "Kiwa",
    "species"
  ],
  [
    "Grimpoteuthis",
    138293,
    "Mollusca",
    "Cephalopoda",
    "Octopoda",
    "Grimpoteuthidae",
    "Grimpoteuthis",
    "genus"
  ],
  [
    "Scotoplanes globosa",
    148773,
    "Echinodermata",
    "Holothuroidea",
    "Elasipodida",
    "Elpidiidae",
    "Scotoplanes",
    "species"
  ],
  [
    "Pseudoliparis swirei",
    1047485,
    "Chordata",
    "Teleostei",
    "Perciformes",
    "Liparidae",
    "Pseudoliparis",
    "species"
  ],
  [
    "Atolla wyvillei",
    135282,
    "Cnidaria",
    "Scyphozoa",
    "Coronatae",
    "Atollidae",
    "Atolla",
    "species"
  ],
  [
    "Alicella gigantea",
    488208,
    "Arthropoda",
    "Malacostraca",
    "Amphipoda",
    "Alicellidae",
    "Alicella",
    "species"
  ],
  [
    "Hippocampus hippocampus",
    127380,
    "Chordata",
    "Teleostei",
    "Syngnathiformes",
    "Syngnathidae",
    "Hippocampus",
    "species"
  ],
  [
    "Antedon bifida",
    124201,
    "Echinodermata",
    "Crinoidea",
    "Comatulida",
    "Antedonidae",
    "Antedon",
    "species"
  ],
  [
    "Chromodoris lochi",
    558198,
    "Mollusca",
    "Gastropoda",
    "Nudibranchia",
    "Chromodorididae",
    "Chromodoris",
    "species"
  ],
  [
    "Pterois volitans",
    159559,
    "Chordata",
    "Teleostei",
    "Perciformes",
    "Scorpaenidae",
    "Pterois",
    "species"
  ],
  [
    "Lampocteis cruentiventer",
    265955,
    "Ctenophora",
    "Tentaculata",
    "Lobata",
    "Lampoctenidae",
    "Lampocteis",
    "species"
  ],
  [
    "Macropinna microstoma",
    281482,
    "Chordata",
    "Teleostei",
    "Argentiniformes",
    "Opisthoproctidae",
    "Macropinna",
    "species"
  ],
  [
    "Argyropelecus hemigymnus",
    127309,
    "Chordata",
    "Teleostei",
    "Stomiiformes",
    "Sternoptychidae",
    "Argyropelecus",
    "species"
  ],
  [
    "Umbellula encrinus",
    128529,
    "Cnidaria",
    "Octocorallia",
    "Scleralcyonacea",
    "Umbellulidae",
    "Umbellula",
    "species"
  ],
  [
    "Bathypterois grallator",
    126343,
    "Chordata",
    "Teleostei",
    "Aulopiformes",
    "Ipnopidae",
    "Bathypterois",
    "species"
  ],
  [
    "Freyella elegans",
    123692,
    "Echinodermata",
    "Asteroidea",
    "Brisingida",
    "Freyellidae",
    "Freyella",
    "species"
  ],
  [
    "Bathynomus giganteus",
    259252,
    "Arthropoda",
    "Malacostraca",
    "Isopoda",
    "Cirolanidae",
    "Bathynomus",
    "species"
  ],
  [
    "Hirondellea gigas",
    428677,
    "Arthropoda",
    "Malacostraca",
    "Amphipoda",
    "Hirondelleidae",
    "Hirondellea",
    "species"
  ]
];
const byName = new Map(RECORDS.map(record => [record[0], record]));

export function scientificProfile(scientificName) {
  const record = byName.get(scientificName);
  if (!record) throw new Error('Missing scientific prototype: ' + scientificName);
  const [, aphiaId, phylum, className, order, family, genus, rank] = record;
  return {
    scientificName,
    prototype: rank === 'genus' ? '属级科学原型；未指定为某个已命名物种' : '真实物种原型；中文别名及共鸣能力为游戏设定',
    taxonomy: {
      phylum: PHYLUM_NAMES[phylum] + ' ' + phylum,
      class: CLASS_NAMES[className] + ' ' + className,
      order, family, genus, rank,
      group: GROUPS[className],
      aphiaId,
      source: 'https://www.marinespecies.org/aphia.php?p=taxdetails&id=' + aphiaId,
      checkedAt: '2026-11-12',
    },
  };
}
