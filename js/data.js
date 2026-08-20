// data.js — reference data: name map, staff register, constants
// Loaded first — all modules depend on these

const NAME_MAP={
  // Maps variant spellings found in source exports -> canonical roster name.
  // Populate with your own aliases; entries below are illustrative only.
  'Wren  Adler':'Wren Adler','Wren M. Adler':'Wren Adler',
  'Vesper  Noble':'Vesper Noble','Vesper M. Noble':'Vesper Noble',
  'Jules  Yates':'Jules Yates','Jules M. Yates':'Jules Yates',
  'Jordan  Radley':'Jordan Radley','Jordan M. Radley':'Jordan Radley',
  'Lane  Ellis':'Lane Ellis','Lane M. Ellis':'Lane Ellis',
  'Yael  Zane':'Yael Zane','Yael M. Zane':'Yael Zane',
};

const DEFAULT_STAFF=[
  // [name, location, has_hours, site_note]
  // HEAD OFFICE
  ["Wren Adler","Head Office",true,""],["Vesper Noble","Head Office",true,""],
  ["Jules Yates","Head Office",true,""],["Jordan Radley","Head Office",true,""],
  ["Lane Ellis","Head Office",true,""],["Yael Zane","Head Office",true,""],
  ["Finley Ewing","Head Office",true,""],["Morgan Iverson","Head Office",true,""],
  ["Tatum Calder","Head Office",true,""],["Cleo Vaughn","Head Office",true,""],
  ["Parker Rhodes","Head Office",true,""],["Emery Crane","Head Office",true,""],
  ["Quinn Iverson","Head Office",true,""],["Logan Tanner","Head Office",true,""],
  ["Marlow Pruitt","Head Office",true,""],["Eli Joyce","Head Office",true,"Ext. Support Vendor 1"],
  ["Wren Blythe","Head Office",true,""],["Hollis Pike","Head Office",true,""],
  ["Skyler Vaughn","Head Office",true,""],["Emery Whitlock","Head Office",true,""],
  ["Vesper Kerr","Head Office",true,""],["Peyton Jarvis","Head Office",true,""],
  ["Isa Noble","Head Office",true,""],["Harper Noble","Head Office",true,""],
  ["Cleo Zane","Head Office",true,""],["Morgan Ewing","Head Office",false,"Ext. Support Vendor 2"],
  ["Lane Crane","Head Office",true,""],["Indigo Vaughn","Head Office",true,""],
  ["Val Orme","Head Office",true,""],["Winter Kerr","Head Office",true,""],
  ["Harper Ames","Head Office",true,""],["Morgan Bright","Head Office",true,""],
  ["Emery Quill","Head Office",true,""],["Gale Joyce","Head Office",true,""],
  ["Vesper Irwin","Head Office",true,""],["Peyton Whitlock","Head Office",false,""],
  ["Nico Keane","Head Office",true,"Client Site I"],["Blair Pruitt","Head Office",true,""],
  // PLANT OFFICE
  ["Finley Ulmer","Plant Office",false,""],["Kendall Marsh","Plant Office",true,""],
  ["Wren Dorsey","Plant Office",true,""],["Ash Crane","Plant Office",true,""],
  ["Morgan Keane","Plant Office",true,""],["Teagan Ulmer","Plant Office",true,""],
  ["Dana Chase","Plant Office",true,""],["Isa Mercer","Plant Office",true,""],
  ["Onyx Dorsey","Plant Office",true,""],["Frankie Salter","Plant Office",true,""],
  ["Harper Adler","Plant Office",true,""],["Quinn Orme","Plant Office",true,""],
  ["Winter Bright","Plant Office",true,""],["Gray Kerr","Plant Office",true,""],
  ["Morgan Calder","Plant Office",true,""],["Jordan Wilder","Plant Office",true,""],
  ["Sage Lowry","Plant Office",true,""],["Bryn Yates","Plant Office",true,""],
  ["Jules Hale","Plant Office",true,""],["Noel Pike","Plant Office",true,""],
  ["Gray Hume","Plant Office",true,""],["Nico Whitlock","Plant Office",true,""],
  ["Peyton Vaughn","Plant Office",true,""],["Xen Quill","Plant Office",true,""],
  ["Jules Pike","Plant Office",true,""],["Teagan Blythe","Plant Office",true,""],
  ["Eli Hale","Plant Office",true,""],["Ari Sloane","Plant Office",true,""],
  ["Blair Irwin","Plant Office",true,""],["Devon Jarvis","Plant Office",true,""],
  ["Zion Kerr","Plant Office",true,""],["Frankie Wilder","Plant Office",true,"Client Site H"],
  ["Vesper Gable","Plant Office",true,""],["Skyler Ewing","Plant Office",true,""],
  ["Casey Noble","Plant Office",true,""],
  // REGION B SITES
  ["Teagan Vaughn","Region B Sites",true,"Client Site A"],["Skyler Joyce","Region B Sites",true,"Client Site G"],
  ["Blair Marsh","Region B Sites",true,"Warehouse"],["Dana Pruitt","Region B Sites",true,"Client Site G"],
  ["Marlow Yorke","Region B Sites",true,"Client Site J"],["Winter Vance","Region B Sites",true,"Warehouse"],
  ["Zion Bower","Region B Sites",true,"Client Site L"],["Rowan Zane","Region B Sites",true,"Client Site L"],
  ["Ash Thorne","Region B Sites",true,"Client Site L"],["Onyx Nash","Region B Sites",true,"Client Site F"],
  ["Harper Lowry","Region B Sites",true,"Client Site G"],["Zion Irwin","Region B Sites",true,"Warehouse"],
  ["Vesper Bright","Region B Sites",true,"Client Site K"],["Teagan Orme","Region B Sites",true,"Warehouse"],
  ["Teagan Gable","Region B Sites",true,"Warehouse"],["Wren Radley","Region B Sites",true,"Warehouse"],
  ["Xen Ellis","Region B Sites",true,"Warehouse"],["Reese Ulmer","Region B Sites",true,"Client Site G"],
  ["Wren Mercer","Region B Sites",true,"Warehouse"],["Kendall Orton","Region B Sites",true,"Plant"],
  ["Morgan Orme","Region B Sites",true,"Warehouse"],["Val Tanner","Region B Sites",true,"Client Site J"],
  ["Vesper Chase","Region B Sites",true,"Warehouse"],["Bryn Bower","Region B Sites",true,"Client Site E"],
  ["Rowan Rhodes","Region B Sites",true,"Warehouse"],["Winter Hale","Region B Sites",true,"Client Site G"],
  ["Gray Fairfax","Region B Sites",true,"Warehouse"],
  // REGION A SITES
  ["Nico Kerr","Region A Sites",true,"Client Site C"],["Cleo Rhodes","Region A Sites",true,"Client Site B"],
  ["Gray Orme","Region A Sites",true,"Client Site C"],["Marlow Zane","Region A Sites",true,"Client Site I"],
  ["Teagan Grady","Region A Sites",true,"Client Site I"],["Yael Radley","Region A Sites",true,"Client Site D"],
  ["Gale Vance","Region A Sites",true,"Client Site H"],["Emery Fairfax","Region A Sites",true,"Client Site I"],
  ["Bexley Thorne","Region A Sites",true,"Client Site C"],["Nico Adler","Region A Sites",true,"Client Site B"],
  ["Gale Bright","Region A Sites",true,"Client Site B"],["Umber Fairfax","Region A Sites",true,"Client Site C"],
  ["Casey Orton","Region A Sites",true,"Client Site H"],["Casey Grady","Region A Sites",true,"Client Site I"],
  ["Eli Vance","Region A Sites",true,"Client Site F"],["Kendall Rhodes","Region A Sites",true,"Client Site H"],
  ["Teagan Vance","Region A Sites",true,"Client Site I"],["Vesper Lamb","Region A Sites",true,"Client Site E"],
  ["Vesper Dorsey","Region A Sites",true,"Client Site I"],["Frankie Crane","Region A Sites",true,"Client Site H"],
  ["Blair Rhodes","Region A Sites",true,"Client Site I"],["Vesper Jarvis","Region A Sites",true,"Client Site B"],
  ["Blair Chase","Region A Sites",true,"Client Site I"],["Tatum Dorsey","Region A Sites",true,"Client Site B"],
  ["Gale Adler","Region A Sites",true,"Client Site H"],["Jordan Joyce","Region A Sites",true,"Client Site C"],
  ["Peyton Radley","Region A Sites",true,"Client Site H"],
  // OVERSEAS SITE
  ["Finley Calder","Overseas Site",true,"Overseas Base"],["Ari Orme","Overseas Site",true,"Overseas Base"],
  // HYBRID
  ["Alex Gable","Hybrid",true,"Full remote"],["Tatum Doyle","Hybrid",true,"Fortnightly Head Office"],
  ["Val Thorne","Hybrid",true,"On need basis"],["Devon Mercer","Hybrid",true,"Full remote"],
];

const SITE_LOCS=new Set(['Region A Sites','Region B Sites']);

let staffList=DEFAULT_STAFF;

const BADGE_CLS={hybrid:'b-hy',leave:'b-lv',abs:'b-ab',ll:'b-ll',late:'b-la',early:'b-ea',ot:'b-ot',full:'b-fu',good:'b-go',mod:'b-mo',poor:'b-po'};

const BADGE_LBL={hybrid:'Hybrid',leave:'Leave',abs:'Absent',ll:'Late+Left Early',late:'Late',early:'Left Early',ot:'Overtime',full:'Full',good:'Good',mod:'Moderate',poor:'Poor'};

const PIE_COLORS=['#3b6d11','#185fa5','#534ab7','#ba7517','#a32d2d','#888780','#c8b8f5'];

const PIE_LBLS=['Full','Good','Moderate','Poor','Absent','Leave','Hybrid'];
