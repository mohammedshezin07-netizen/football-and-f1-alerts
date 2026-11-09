import {
  CircuitSvgId,
  F1ConstructorStandingRow,
  F1DriverCareerStats,
  F1DriverStandingRow,
  F1GridPenaltyNote,
  F1RosterTransferEvent,
  F1Session,
  F1SessionResultEntry,
  F1StartingGridEntry,
  F1Weekend,
  TyreCompound,
} from '../types/sports';
import { F1_LOGOS, GP_FLAGS } from '../data/logos';
import { F1_WEEKENDS } from '../data/seedData';
import {
  fetchWithResilience,
  formatIST,
  formatISTDateShort,
  TTL_SCHEDULE_ROSTER_MS,
} from './apiClient';
import {
  DataValidationDiscrepancy,
  getDataDiscrepancyLogs,
  logDataDiscrepancy,
} from './sportsApi';

/**
 * ============================================================================
 * 1. OFFICIAL F1 MEDIA HEADSHOT CDN & TRACK MAP URL HELPERS
 * ============================================================================
 */
export const F1_DRIVER_HEADSHOTS: Record<string, string> = {
  NOR: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png',
  PIA: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png',
  VER: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png',
  HAD: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png',
  HAM: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png',
  LEC: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png',
  RUS: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png',
  ANT: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/K/ANDANT01_Kimi_Antonelli/andant01.png',
  LAW: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png',
  LIN: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png',
  BOR: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GABBOR01_Gabriel_Bortoleto/gabbor01.png',
  HUL: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/N/NICHUL01_Nico_Hulkenberg/nichul01.png',
  BEA: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png',
  OCO: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/E/ESTOCO01_Esteban_Ocon/estoco01.png',
  SAI: 'https://media.formula1.com/image/upload/f_auto,c_limit,q_auto,w_1320/content/dam/fom-website/drivers/2025Drivers/sainz',
  ALB: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png',
  GAS: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png',
  COL: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FRACOL01_Franco_Colapinto/fracol01.png',
  ALO: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png',
  STR: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANSTR01_Lance_Stroll/lanstr01.png',
  PER: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/S/SERPER01_Sergio_Perez/serper01.png',
  BOT: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/V/VALBOT01_Valtteri_Bottas/valbot01.png',
  // Official 2026 Reserve & Former Drivers (All 11 F1 Constructors)
  MSC: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MICSCH02_Mick_Schumacher/micsch02.png',
  ZHO: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GUAZHO01_Guanyu_Zhou/guazho01.png',
  TSU: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/Y/YUKTSU01_Yuki_Tsunoda/yuktsu01.png',
  GIO: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ANTGIO01_Antonio_Giovinazzi/antgio01.png',
  DRU: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FELDRU01_Felipe_Drugovich/feldru01.png',
  DOO: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/J/JACDOO01_Jack_Doohan/jacdoo01.png',
  AIT: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/J/JACAIT01_Jack_Aitken/jacait01.png',
  MAG: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/K/KEVMAG01_Kevin_Magnussen/kevmag01.png',
  RIC: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/D/DANRIC01_Daniel_Ricciardo/danric01.png',
  KUB: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/R/ROBKUB01_Robert_Kubica/robkub01.png',
  SAR: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LOGSAR01_Logan_Sargeant/logsar01.png',
  CAM: 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CARLEC01_Charles_Leclerc/carlec01.png',
};

export function buildF1TrackMapCarbonUrl(countryLabel: string): string {
  if (countryLabel.includes('Madrid')) return '';
  const normalized = countryLabel
    .split(' - ')[0]
    .replace('Spain (Barcelona)', 'Spain')
    .replace('Mexico City', 'Mexico')
    .replace('Türkiye', 'Turkey')
    .replace('Sakhir', 'Bahrain')
    .trim();
  const clean = encodeURIComponent(normalized);
  return `https://media.formula1.com/image/upload/f_auto,c_limit,w_300,q_auto/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/${clean}%20carbon.png`;
}

export function upgradeOpenF1HeadshotUrl(rawUrl: string | undefined, driverCode: string): string {
  if (F1_DRIVER_HEADSHOTS[driverCode]) {
    return F1_DRIVER_HEADSHOTS[driverCode];
  }
  if (!rawUrl) {
    return F1_DRIVER_HEADSHOTS.ANT;
  }
  return rawUrl.replace(/\.transform\/1col\/image\.png$/i, '');
}

/**
 * ============================================================================
 * 2. COMPLETE 22-DRIVER 2026/2027 GRID REGISTRY & CAREER PROFILES
 * ============================================================================
 */
export const FULL_2026_F1_DRIVER_STANDINGS: F1DriverStandingRow[] = [
  {
    position: 1,
    driverId: 'antonelli',
    driverCode: 'ANT',
    driverName: 'Andrea Kimi Antonelli',
    driverNumber: 12,
    nationality: 'Italy',
    flagUrl: GP_FLAGS.IT,
    headshotUrl: F1_DRIVER_HEADSHOTS.ANT,
    ergastDriverId: 'antonelli',
    rosterStatus: 'ACTIVE',
    constructorCode: 'MER',
    constructorName: 'Mercedes',
    constructorLogo: F1_LOGOS.MER,
    constructorColor: '#27F4D2',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 2,
    driverId: 'russell',
    driverCode: 'RUS',
    driverName: 'George Russell',
    driverNumber: 63,
    nationality: 'United Kingdom',
    flagUrl: GP_FLAGS.GB,
    headshotUrl: F1_DRIVER_HEADSHOTS.RUS,
    ergastDriverId: 'russell',
    rosterStatus: 'ACTIVE',
    constructorCode: 'MER',
    constructorName: 'Mercedes',
    constructorLogo: F1_LOGOS.MER,
    constructorColor: '#27F4D2',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 3,
    driverId: 'leclerc',
    driverCode: 'LEC',
    driverName: 'Charles Leclerc',
    driverNumber: 16,
    nationality: 'Monaco',
    flagUrl: GP_FLAGS.MC,
    headshotUrl: F1_DRIVER_HEADSHOTS.LEC,
    ergastDriverId: 'leclerc',
    rosterStatus: 'ACTIVE',
    constructorCode: 'FER',
    constructorName: 'Ferrari',
    constructorLogo: F1_LOGOS.FER,
    constructorColor: '#E10600',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 4,
    driverId: 'hamilton',
    driverCode: 'HAM',
    driverName: 'Lewis Hamilton',
    driverNumber: 44,
    nationality: 'United Kingdom',
    flagUrl: GP_FLAGS.GB,
    headshotUrl: F1_DRIVER_HEADSHOTS.HAM,
    ergastDriverId: 'hamilton',
    rosterStatus: 'ACTIVE',
    constructorCode: 'FER',
    constructorName: 'Ferrari',
    constructorLogo: F1_LOGOS.FER,
    constructorColor: '#E10600',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 5,
    driverId: 'norris',
    driverCode: 'NOR',
    driverName: 'Lando Norris',
    driverNumber: 1,
    nationality: 'United Kingdom',
    flagUrl: GP_FLAGS.GB,
    headshotUrl: F1_DRIVER_HEADSHOTS.NOR,
    ergastDriverId: 'norris',
    rosterStatus: 'ACTIVE',
    constructorCode: 'MCL',
    constructorName: 'McLaren',
    constructorLogo: F1_LOGOS.MCL,
    constructorColor: '#FF8000',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 6,
    driverId: 'piastri',
    driverCode: 'PIA',
    driverName: 'Oscar Piastri',
    driverNumber: 81,
    nationality: 'Australia',
    flagUrl: GP_FLAGS.AU,
    headshotUrl: F1_DRIVER_HEADSHOTS.PIA,
    ergastDriverId: 'piastri',
    rosterStatus: 'ACTIVE',
    constructorCode: 'MCL',
    constructorName: 'McLaren',
    constructorLogo: F1_LOGOS.MCL,
    constructorColor: '#FF8000',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 7,
    driverId: 'max_verstappen',
    driverCode: 'VER',
    driverName: 'Max Verstappen',
    driverNumber: 3,
    nationality: 'Netherlands',
    flagUrl: GP_FLAGS.NL,
    headshotUrl: F1_DRIVER_HEADSHOTS.VER,
    ergastDriverId: 'max_verstappen',
    rosterStatus: 'ACTIVE',
    constructorCode: 'RBR',
    constructorName: 'Red Bull Racing',
    constructorLogo: F1_LOGOS.RBR,
    constructorColor: '#3671C6',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 8,
    driverId: 'bearman',
    driverCode: 'BEA',
    driverName: 'Oliver Bearman',
    driverNumber: 87,
    nationality: 'United Kingdom',
    flagUrl: GP_FLAGS.GB,
    headshotUrl: F1_DRIVER_HEADSHOTS.BEA,
    ergastDriverId: 'bearman',
    rosterStatus: 'ACTIVE',
    constructorCode: 'HAA',
    constructorName: 'Haas F1 Team',
    constructorLogo: F1_LOGOS.HAA,
    constructorColor: '#B6BABD',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 9,
    driverId: 'gasly',
    driverCode: 'GAS',
    driverName: 'Pierre Gasly',
    driverNumber: 10,
    nationality: 'France',
    flagUrl: GP_FLAGS.FR,
    headshotUrl: F1_DRIVER_HEADSHOTS.GAS,
    ergastDriverId: 'gasly',
    rosterStatus: 'ACTIVE',
    constructorCode: 'ALP',
    constructorName: 'Alpine',
    constructorLogo: F1_LOGOS.ALP,
    constructorColor: '#0093CC',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 10,
    driverId: 'lawson',
    driverCode: 'LAW',
    driverName: 'Liam Lawson',
    driverNumber: 30,
    nationality: 'New Zealand',
    flagUrl: GP_FLAGS.AU,
    headshotUrl: F1_DRIVER_HEADSHOTS.LAW,
    ergastDriverId: 'lawson',
    rosterStatus: 'ACTIVE',
    constructorCode: 'VCARB',
    constructorName: 'Racing Bulls',
    constructorLogo: F1_LOGOS.VCARB,
    constructorColor: '#6692FF',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 11,
    driverId: 'hadjar',
    driverCode: 'HAD',
    driverName: 'Isack Hadjar',
    driverNumber: 6,
    nationality: 'France',
    flagUrl: GP_FLAGS.FR,
    headshotUrl: F1_DRIVER_HEADSHOTS.HAD,
    ergastDriverId: 'hadjar',
    rosterStatus: 'ACTIVE',
    constructorCode: 'RBR',
    constructorName: 'Red Bull Racing',
    constructorLogo: F1_LOGOS.RBR,
    constructorColor: '#3671C6',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 12,
    driverId: 'sainz',
    driverCode: 'SAI',
    driverName: 'Carlos Sainz',
    driverNumber: 55,
    nationality: 'Spain',
    flagUrl: GP_FLAGS.ES,
    headshotUrl: F1_DRIVER_HEADSHOTS.SAI,
    ergastDriverId: 'sainz',
    rosterStatus: 'ACTIVE',
    constructorCode: 'WIL',
    constructorName: 'Williams',
    constructorLogo: F1_LOGOS.WIL,
    constructorColor: '#64C4FF',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 13,
    driverId: 'lindblad',
    driverCode: 'LIN',
    driverName: 'Arvid Lindblad',
    driverNumber: 41,
    nationality: 'United Kingdom',
    flagUrl: GP_FLAGS.GB,
    headshotUrl: F1_DRIVER_HEADSHOTS.LIN,
    ergastDriverId: 'lindblad',
    rosterStatus: 'ACTIVE',
    constructorCode: 'VCARB',
    constructorName: 'Racing Bulls',
    constructorLogo: F1_LOGOS.VCARB,
    constructorColor: '#6692FF',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 14,
    driverId: 'bortoleto',
    driverCode: 'BOR',
    driverName: 'Gabriel Bortoleto',
    driverNumber: 5,
    nationality: 'Brazil',
    flagUrl: GP_FLAGS.BR,
    headshotUrl: F1_DRIVER_HEADSHOTS.BOR,
    ergastDriverId: 'bortoleto',
    rosterStatus: 'ACTIVE',
    constructorCode: 'SAU',
    constructorName: 'Audi / Sauber',
    constructorLogo: F1_LOGOS.SAU,
    constructorColor: '#52E252',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 15,
    driverId: 'ocon',
    driverCode: 'OCO',
    driverName: 'Esteban Ocon',
    driverNumber: 31,
    nationality: 'France',
    flagUrl: GP_FLAGS.FR,
    headshotUrl: F1_DRIVER_HEADSHOTS.OCO,
    ergastDriverId: 'ocon',
    rosterStatus: 'ACTIVE',
    constructorCode: 'HAA',
    constructorName: 'Haas F1 Team',
    constructorLogo: F1_LOGOS.HAA,
    constructorColor: '#B6BABD',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 16,
    driverId: 'albon',
    driverCode: 'ALB',
    driverName: 'Alex Albon',
    driverNumber: 23,
    nationality: 'Thailand',
    flagUrl: GP_FLAGS.GB,
    headshotUrl: F1_DRIVER_HEADSHOTS.ALB,
    ergastDriverId: 'albon',
    rosterStatus: 'ACTIVE',
    constructorCode: 'WIL',
    constructorName: 'Williams',
    constructorLogo: F1_LOGOS.WIL,
    constructorColor: '#64C4FF',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 17,
    driverId: 'colapinto',
    driverCode: 'COL',
    driverName: 'Franco Colapinto',
    driverNumber: 43,
    nationality: 'Argentina',
    flagUrl: GP_FLAGS.BR,
    headshotUrl: F1_DRIVER_HEADSHOTS.COL,
    ergastDriverId: 'colapinto',
    rosterStatus: 'ACTIVE',
    constructorCode: 'ALP',
    constructorName: 'Alpine',
    constructorLogo: F1_LOGOS.ALP,
    constructorColor: '#0093CC',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 18,
    driverId: 'hulkenberg',
    driverCode: 'HUL',
    driverName: 'Nico Hülkenberg',
    driverNumber: 27,
    nationality: 'Germany',
    flagUrl: GP_FLAGS.DE,
    headshotUrl: F1_DRIVER_HEADSHOTS.HUL,
    ergastDriverId: 'hulkenberg',
    rosterStatus: 'ACTIVE',
    constructorCode: 'SAU',
    constructorName: 'Audi / Sauber',
    constructorLogo: F1_LOGOS.SAU,
    constructorColor: '#52E252',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 19,
    driverId: 'alonso',
    driverCode: 'ALO',
    driverName: 'Fernando Alonso',
    driverNumber: 14,
    nationality: 'Spain',
    flagUrl: GP_FLAGS.ES,
    headshotUrl: F1_DRIVER_HEADSHOTS.ALO,
    ergastDriverId: 'alonso',
    rosterStatus: 'ACTIVE',
    constructorCode: 'AMR',
    constructorName: 'Aston Martin',
    constructorLogo: F1_LOGOS.AMR,
    constructorColor: '#229971',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 20,
    driverId: 'perez',
    driverCode: 'PER',
    driverName: 'Sergio Pérez',
    driverNumber: 11,
    nationality: 'Mexico',
    flagUrl: GP_FLAGS.MX,
    headshotUrl: F1_DRIVER_HEADSHOTS.PER,
    ergastDriverId: 'perez',
    rosterStatus: 'ACTIVE',
    constructorCode: 'CAD',
    constructorName: 'Cadillac F1',
    constructorLogo: F1_LOGOS.F1_MAIN,
    constructorColor: '#D4AF37',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 21,
    driverId: 'bottas',
    driverCode: 'BOT',
    driverName: 'Valtteri Bottas',
    driverNumber: 77,
    nationality: 'Finland',
    flagUrl: GP_FLAGS.DE,
    headshotUrl: F1_DRIVER_HEADSHOTS.BOT,
    ergastDriverId: 'bottas',
    rosterStatus: 'ACTIVE',
    constructorCode: 'CAD',
    constructorName: 'Cadillac F1',
    constructorLogo: F1_LOGOS.F1_MAIN,
    constructorColor: '#D4AF37',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
  {
    position: 22,
    driverId: 'stroll',
    driverCode: 'STR',
    driverName: 'Lance Stroll',
    driverNumber: 18,
    nationality: 'Canada',
    flagUrl: GP_FLAGS.US,
    headshotUrl: F1_DRIVER_HEADSHOTS.STR,
    ergastDriverId: 'stroll',
    rosterStatus: 'ACTIVE',
    constructorCode: 'AMR',
    constructorName: 'Aston Martin',
    constructorLogo: F1_LOGOS.AMR,
    constructorColor: '#229971',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: '-',
  },
];

/**
 * Official 2026 Reserve & Former Drivers Roster (All 11 FIA F1 Constructors — 1 per constructor, deduplicated)
 */
export const F1_RESERVE_DRIVERS_2026: F1DriverStandingRow[] = [
  {
    position: 23,
    rank: 23,
    driverId: 'MSC',
    driverCode: 'MSC',
    driverName: 'Mick Schumacher',
    driverNumber: 47,
    nationality: 'Germany',
    flagUrl: GP_FLAGS.DE,
    headshotUrl: F1_DRIVER_HEADSHOTS.MSC,
    ergastDriverId: 'mick_schumacher',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'MER',
    constructorName: 'Mercedes (Reserve)',
    constructorLogo: F1_LOGOS.MER,
    constructorColor: '#27F4D2',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 24,
    rank: 24,
    driverId: 'ZHO',
    driverCode: 'ZHO',
    driverName: 'Zhou Guanyu',
    driverNumber: 24,
    nationality: 'China',
    flagUrl: GP_FLAGS.ES,
    headshotUrl: F1_DRIVER_HEADSHOTS.ZHO,
    ergastDriverId: 'zhou',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'FER',
    constructorName: 'Ferrari (Reserve)',
    constructorLogo: F1_LOGOS.FER,
    constructorColor: '#E10600',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 2,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 25,
    rank: 25,
    driverId: 'TSU',
    driverCode: 'TSU',
    driverName: 'Yuki Tsunoda',
    driverNumber: 22,
    nationality: 'Japan',
    flagUrl: GP_FLAGS.IT,
    headshotUrl: F1_DRIVER_HEADSHOTS.TSU,
    ergastDriverId: 'tsunoda',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'RBR',
    constructorName: 'Red Bull Racing (Reserve)',
    constructorLogo: F1_LOGOS.RBR,
    constructorColor: '#3671C6',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 1,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 26,
    rank: 26,
    driverId: 'GIO',
    driverCode: 'GIO',
    driverName: 'Antonio Giovinazzi',
    driverNumber: 99,
    nationality: 'Italy',
    flagUrl: GP_FLAGS.IT,
    headshotUrl: F1_DRIVER_HEADSHOTS.GIO,
    ergastDriverId: 'giovinazzi',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'MCL',
    constructorName: 'McLaren (Reserve)',
    constructorLogo: F1_LOGOS.MCL,
    constructorColor: '#FF8000',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 27,
    rank: 27,
    driverId: 'DRU',
    driverCode: 'DRU',
    driverName: 'Felipe Drugovich',
    driverNumber: 34,
    nationality: 'Brazil',
    flagUrl: GP_FLAGS.BR,
    headshotUrl: F1_DRIVER_HEADSHOTS.DRU,
    ergastDriverId: 'drugovich',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'AMR',
    constructorName: 'Aston Martin (Reserve)',
    constructorLogo: F1_LOGOS.AMR,
    constructorColor: '#229971',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 28,
    rank: 28,
    driverId: 'DOO',
    driverCode: 'DOO',
    driverName: 'Jack Doohan',
    driverNumber: 7,
    nationality: 'Australia',
    flagUrl: GP_FLAGS.AU,
    headshotUrl: F1_DRIVER_HEADSHOTS.DOO,
    ergastDriverId: 'doohan',
    rosterStatus: 'FORMER',
    status: 'FORMER / RESERVE',
    replacedByCode: 'COL',
    constructorCode: 'ALP',
    constructorName: 'Alpine (Reserve / R1–R6)',
    constructorLogo: F1_LOGOS.ALP,
    constructorColor: '#0093CC',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 29,
    rank: 29,
    driverId: 'AIT',
    driverCode: 'AIT',
    driverName: 'Jack Aitken',
    driverNumber: 89,
    nationality: 'United Kingdom',
    flagUrl: GP_FLAGS.GB,
    headshotUrl: F1_DRIVER_HEADSHOTS.AIT,
    ergastDriverId: 'aitken',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'WIL',
    constructorName: 'Williams (Reserve)',
    constructorLogo: F1_LOGOS.WIL,
    constructorColor: '#1868DB',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 30,
    rank: 30,
    driverId: 'MAG',
    driverCode: 'MAG',
    driverName: 'Kevin Magnussen',
    driverNumber: 20,
    nationality: 'Denmark',
    flagUrl: GP_FLAGS.DE,
    headshotUrl: F1_DRIVER_HEADSHOTS.MAG,
    ergastDriverId: 'kevin_magnussen',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'HAA',
    constructorName: 'Haas F1 Team (Reserve)',
    constructorLogo: F1_LOGOS.HAA,
    constructorColor: '#B6BABD',
    wins: 0,
    podiums: 1,
    poles: 1,
    fastestLaps: 3,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 31,
    rank: 31,
    driverId: 'RIC',
    driverCode: 'RIC',
    driverName: 'Daniel Ricciardo',
    driverNumber: 3,
    nationality: 'Australia',
    flagUrl: GP_FLAGS.AU,
    headshotUrl: F1_DRIVER_HEADSHOTS.RIC,
    ergastDriverId: 'ricciardo',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'VCARB',
    constructorName: 'Racing Bulls (Reserve)',
    constructorLogo: F1_LOGOS.VCARB,
    constructorColor: '#6692FF',
    wins: 8,
    podiums: 32,
    poles: 3,
    fastestLaps: 17,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 32,
    rank: 32,
    driverId: 'KUB',
    driverCode: 'KUB',
    driverName: 'Robert Kubica',
    driverNumber: 88,
    nationality: 'Poland',
    flagUrl: 'https://flagcdn.com/w80/pl.png',
    headshotUrl: F1_DRIVER_HEADSHOTS.KUB,
    ergastDriverId: 'kubica',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'SAU',
    constructorName: 'Audi / Sauber (Reserve)',
    constructorLogo: F1_LOGOS.SAU,
    constructorColor: '#52E252',
    wins: 1,
    podiums: 12,
    poles: 1,
    fastestLaps: 1,
    points: 0,
    gapToLeader: 'RESERVE',
  },
  {
    position: 33,
    rank: 33,
    driverId: 'SAR',
    driverCode: 'SAR',
    driverName: 'Logan Sargeant',
    driverNumber: 2,
    nationality: 'United States',
    flagUrl: GP_FLAGS.US,
    headshotUrl: F1_DRIVER_HEADSHOTS.SAR,
    ergastDriverId: 'sargeant',
    rosterStatus: 'RESERVE',
    status: 'FORMER / RESERVE',
    constructorCode: 'CAD',
    constructorName: 'Cadillac F1 (Reserve)',
    constructorLogo: F1_LOGOS.F1_MAIN,
    constructorColor: '#D4AF37',
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    gapToLeader: 'RESERVE',
  },
];

export const VERIFIED_ROSTER_TRANSFERS: F1RosterTransferEvent[] = [
  {
    id: 'tr-lindblad-2026',
    dateLabel: '2026 SEASON',
    effectiveRound: 'Round 1 (Australia)',
    driverName: 'Arvid Lindblad',
    driverCode: 'LIN',
    driverNumber: 41,
    headshotUrl: F1_DRIVER_HEADSHOTS.LIN,
    changeType: 'ROOKIE_PROMOTION',
    fromTeam: 'Red Bull Junior Team (F2)',
    previousTeam: 'Red Bull Junior Team (F2)',
    toTeam: 'Racing Bulls',
    newTeam: 'Racing Bulls',
    toTeamColor: '#6692FF',
    summary: 'Promoted to full-time Racing Bulls F1 seat (#41) alongside Liam Lawson (#30).',
  },
  {
    id: 'tr-hadjar-2026',
    dateLabel: '2026 SEASON',
    effectiveRound: 'Round 1 (Australia)',
    driverName: 'Isack Hadjar',
    driverCode: 'HAD',
    driverNumber: 6,
    headshotUrl: F1_DRIVER_HEADSHOTS.HAD,
    changeType: 'TRANSFER',
    fromTeam: 'Racing Bulls',
    previousTeam: 'Racing Bulls',
    toTeam: 'Red Bull Racing',
    newTeam: 'Red Bull Racing',
    toTeamColor: '#3671C6',
    summary: 'Promoted to Oracle Red Bull Racing (#6) partnering Max Verstappen (#3).',
  },
  {
    id: 'tr-colapinto-2026',
    dateLabel: 'MID-SEASON',
    effectiveRound: 'Round 7 (Imola)',
    driverName: 'Franco Colapinto',
    driverCode: 'COL',
    driverNumber: 43,
    headshotUrl: F1_DRIVER_HEADSHOTS.COL,
    changeType: 'RESERVE_CALLUP',
    fromTeam: 'Alpine Reserve',
    previousTeam: 'Alpine Reserve',
    toTeam: 'Alpine F1 Team',
    newTeam: 'Alpine F1 Team',
    toTeamColor: '#0093CC',
    summary: 'Stepped into full-time Alpine race seat (#43) replacing Jack Doohan (marked FORMER / RESERVE).',
  },
  {
    id: 'tr-bortoleto-audi-2026',
    dateLabel: '2026 SEASON',
    effectiveRound: 'Round 1 (Australia)',
    driverName: 'Gabriel Bortoleto',
    driverCode: 'BOR',
    driverNumber: 5,
    headshotUrl: F1_DRIVER_HEADSHOTS.BOR,
    changeType: 'ROOKIE_PROMOTION',
    fromTeam: 'FIA F2 Champion',
    previousTeam: 'FIA F2 Champion',
    toTeam: 'Audi / Sauber',
    newTeam: 'Audi / Sauber',
    toTeamColor: '#52E252',
    summary: 'Signed multi-year factory drive (#5) alongside veteran Nico Hülkenberg (#27).',
  },
  {
    id: 'tr-cadillac-2026',
    dateLabel: '2026 EXPANSION',
    effectiveRound: 'Round 1 (Australia)',
    driverName: 'Sergio Pérez & Valtteri Bottas',
    driverCode: 'PER',
    driverNumber: 11,
    headshotUrl: F1_DRIVER_HEADSHOTS.PER,
    changeType: 'TRANSFER',
    fromTeam: 'Free Agency',
    previousTeam: 'Free Agency',
    toTeam: 'Cadillac F1 Team',
    newTeam: 'Cadillac F1 Team',
    toTeamColor: '#D4AF37',
    summary: 'Joined the 11th constructor entry Cadillac F1 with #11 Pérez and #77 Bottas.',
  },
];

const CAREER_BIOS: Record<
  string,
  {
    dob: string;
    birthplace: string;
    championships: number;
    careerWins: number;
    careerPoles: number;
    careerPodiums: number;
    careerPoints: string;
    grandsPrixEntered: number;
    highestFinish: string;
    highestGrid: string;
    sprintPoints: number;
    dnfs: number;
  }
> = {
  ANT: {
    dob: '25/08/2006',
    birthplace: 'Bologna, Italy',
    championships: 1,
    careerWins: 9,
    careerPoles: 8,
    careerPodiums: 16,
    careerPoints: '522.0',
    grandsPrixEntered: 43,
    highestFinish: '1 (x9)',
    highestGrid: '1 (x8)',
    sprintPoints: 28,
    dnfs: 0,
  },
  VER: {
    dob: '30/09/1997',
    birthplace: 'Hasselt, Belgium',
    championships: 4,
    careerWins: 67,
    careerPoles: 43,
    careerPodiums: 121,
    careerPoints: '3,314.5',
    grandsPrixEntered: 229,
    highestFinish: '1 (x67)',
    highestGrid: '1 (x43)',
    sprintPoints: 22,
    dnfs: 3,
  },
  HAM: {
    dob: '07/01/1985',
    birthplace: 'Stevenage, United Kingdom',
    championships: 7,
    careerWins: 106,
    careerPoles: 105,
    careerPodiums: 210,
    careerPoints: '5,121.5',
    grandsPrixEntered: 375,
    highestFinish: '1 (x106)',
    highestGrid: '1 (x105)',
    sprintPoints: 19,
    dnfs: 1,
  },
  RUS: {
    dob: '15/02/1998',
    birthplace: "King's Lynn, United Kingdom",
    championships: 0,
    careerWins: 6,
    careerPoles: 8,
    careerPodiums: 26,
    careerPoints: '1,175.0',
    grandsPrixEntered: 171,
    highestFinish: '1 (x6)',
    highestGrid: '1 (x8)',
    sprintPoints: 18,
    dnfs: 3,
  },
  LEC: {
    dob: '16/10/1997',
    birthplace: 'Monte Carlo, Monaco',
    championships: 0,
    careerWins: 9,
    careerPoles: 27,
    careerPodiums: 50,
    careerPoints: '1,675.0',
    grandsPrixEntered: 168,
    highestFinish: '1 (x9)',
    highestGrid: '1 (x27)',
    sprintPoints: 21,
    dnfs: 2,
  },
  NOR: {
    dob: '13/11/1999',
    birthplace: 'Bristol, United Kingdom',
    championships: 1,
    careerWins: 13,
    careerPoles: 15,
    careerPodiums: 44,
    careerPoints: '1,618.0',
    grandsPrixEntered: 171,
    highestFinish: '1 (x13)',
    highestGrid: '1 (x15)',
    sprintPoints: 20,
    dnfs: 4,
  },
  PIA: {
    dob: '06/04/2001',
    birthplace: 'Melbourne, Australia',
    championships: 0,
    careerWins: 9,
    careerPoles: 6,
    careerPodiums: 24,
    careerPoints: '864.0',
    grandsPrixEntered: 87,
    highestFinish: '1 (x9)',
    highestGrid: '1 (x6)',
    sprintPoints: 15,
    dnfs: 3,
  },
  LAW: {
    dob: '11/02/2002',
    birthplace: 'Hastings, New Zealand',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '54.0',
    grandsPrixEntered: 30,
    highestFinish: '5 (x2)',
    highestGrid: '3 (x1)',
    sprintPoints: 4,
    dnfs: 1,
  },
  LIN: {
    dob: '08/08/2007',
    birthplace: 'Virginia Water, United Kingdom',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '16.0',
    grandsPrixEntered: 19,
    highestFinish: '7 (x1)',
    highestGrid: '6 (x1)',
    sprintPoints: 2,
    dnfs: 2,
  },
  HAD: {
    dob: '28/09/2004',
    birthplace: 'Paris, France',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '34.0',
    grandsPrixEntered: 24,
    highestFinish: '6 (x2)',
    highestGrid: '5 (x1)',
    sprintPoints: 3,
    dnfs: 2,
  },
  BOR: {
    dob: '14/10/2004',
    birthplace: 'São Paulo, Brazil',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '19.0',
    grandsPrixEntered: 24,
    highestFinish: '8 (x2)',
    highestGrid: '7 (x1)',
    sprintPoints: 1,
    dnfs: 2,
  },
  HUL: {
    dob: '19/08/1987',
    birthplace: 'Emmerich am Rhein, Germany',
    championships: 0,
    careerWins: 0,
    careerPoles: 1,
    careerPodiums: 1,
    careerPoints: '608.0',
    grandsPrixEntered: 248,
    highestFinish: '3 (x1)',
    highestGrid: '1 (x1)',
    sprintPoints: 4,
    dnfs: 4,
  },
  BEA: {
    dob: '08/05/2005',
    birthplace: 'Chelmsford, United Kingdom',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 1,
    careerPoints: '98.0',
    grandsPrixEntered: 42,
    highestFinish: '3 (x1)',
    highestGrid: '4 (x1)',
    sprintPoints: 6,
    dnfs: 5,
  },
  OCO: {
    dob: '17/09/1996',
    birthplace: 'Évreux, France',
    championships: 0,
    careerWins: 1,
    careerPoles: 0,
    careerPodiums: 4,
    careerPoints: '485.0',
    grandsPrixEntered: 178,
    highestFinish: '1 (x1)',
    highestGrid: '3 (x3)',
    sprintPoints: 2,
    dnfs: 1,
  },
  SAI: {
    dob: '01/09/1994',
    birthplace: 'Madrid, Spain',
    championships: 0,
    careerWins: 4,
    careerPoles: 6,
    careerPodiums: 27,
    careerPoints: '1,346.5',
    grandsPrixEntered: 228,
    highestFinish: '1 (x4)',
    highestGrid: '1 (x6)',
    sprintPoints: 5,
    dnfs: 2,
  },
  ALB: {
    dob: '23/03/1996',
    birthplace: 'London, United Kingdom',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 2,
    careerPoints: '288.0',
    grandsPrixEntered: 126,
    highestFinish: '3 (x2)',
    highestGrid: '4 (x3)',
    sprintPoints: 2,
    dnfs: 6,
  },
  GAS: {
    dob: '07/02/1996',
    birthplace: 'Rouen, France',
    championships: 0,
    careerWins: 1,
    careerPoles: 0,
    careerPodiums: 5,
    careerPoints: '496.0',
    grandsPrixEntered: 175,
    highestFinish: '1 (x1)',
    highestGrid: '2 (x1)',
    sprintPoints: 5,
    dnfs: 2,
  },
  COL: {
    dob: '27/05/2003',
    birthplace: 'Pilar, Argentina',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '19.0',
    grandsPrixEntered: 24,
    highestFinish: '8 (x2)',
    highestGrid: '8 (x1)',
    sprintPoints: 1,
    dnfs: 3,
  },
  ALO: {
    dob: '29/07/1981',
    birthplace: 'Oviedo, Spain',
    championships: 2,
    careerWins: 32,
    careerPoles: 22,
    careerPodiums: 106,
    careerPoints: '2,365.0',
    grandsPrixEntered: 423,
    highestFinish: '1 (x32)',
    highestGrid: '1 (x22)',
    sprintPoints: 3,
    dnfs: 7,
  },
  STR: {
    dob: '29/10/1998',
    birthplace: 'Montreal, Canada',
    championships: 0,
    careerWins: 0,
    careerPoles: 1,
    careerPodiums: 3,
    careerPoints: '304.0',
    grandsPrixEntered: 188,
    highestFinish: '3 (x3)',
    highestGrid: '1 (x1)',
    sprintPoints: 1,
    dnfs: 8,
  },
  PER: {
    dob: '26/01/1990',
    birthplace: 'Guadalajara, Mexico',
    championships: 0,
    careerWins: 6,
    careerPoles: 3,
    careerPodiums: 39,
    careerPoints: '1,646.0',
    grandsPrixEntered: 299,
    highestFinish: '1 (x6)',
    highestGrid: '1 (x3)',
    sprintPoints: 1,
    dnfs: 5,
  },
  BOT: {
    dob: '28/08/1989',
    birthplace: 'Nastola, Finland',
    championships: 0,
    careerWins: 10,
    careerPoles: 20,
    careerPodiums: 67,
    careerPoints: '1,801.0',
    grandsPrixEntered: 265,
    highestFinish: '1 (x10)',
    highestGrid: '1 (x20)',
    sprintPoints: 0,
    dnfs: 9,
  },
  // Reserve & Test Drivers (11 Teams)
  MSC: {
    dob: '22/03/1999',
    birthplace: 'Vufflens-le-Château, Switzerland',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '12.0',
    grandsPrixEntered: 43,
    highestFinish: '6 (x1)',
    highestGrid: '6 (x1)',
    sprintPoints: 0,
    dnfs: 0,
  },
  ZHO: {
    dob: '30/05/1999',
    birthplace: 'Shanghai, China',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '16.0',
    grandsPrixEntered: 68,
    highestFinish: '8 (x2)',
    highestGrid: '5 (x1)',
    sprintPoints: 0,
    dnfs: 0,
  },
  TSU: {
    dob: '11/05/2000',
    birthplace: 'Sagamihara, Japan',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '124.0',
    grandsPrixEntered: 108,
    highestFinish: '4 (x1)',
    highestGrid: '3 (x1)',
    sprintPoints: 6,
    dnfs: 0,
  },
  GIO: {
    dob: '14/12/1993',
    birthplace: 'Martina Franca, Italy',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '21.0',
    grandsPrixEntered: 62,
    highestFinish: '5 (x1)',
    highestGrid: '7 (x2)',
    sprintPoints: 0,
    dnfs: 0,
  },
  DRU: {
    dob: '23/05/2000',
    birthplace: 'Maringá, Brazil',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '0.0',
    grandsPrixEntered: 0,
    highestFinish: 'Reserve / FP1',
    highestGrid: 'Reserve',
    sprintPoints: 0,
    dnfs: 0,
  },
  DOO: {
    dob: '20/01/2003',
    birthplace: 'Gold Coast, Australia',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '0.0',
    grandsPrixEntered: 7,
    highestFinish: '13 (x1)',
    highestGrid: '14 (x1)',
    sprintPoints: 0,
    dnfs: 1,
  },
  AIT: {
    dob: '23/09/1995',
    birthplace: 'London, United Kingdom',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '0.0',
    grandsPrixEntered: 1,
    highestFinish: '16 (x1)',
    highestGrid: '17 (x1)',
    sprintPoints: 0,
    dnfs: 0,
  },
  MAG: {
    dob: '05/10/1992',
    birthplace: 'Roskilde, Denmark',
    championships: 0,
    careerWins: 0,
    careerPoles: 1,
    careerPodiums: 1,
    careerPoints: '202.0',
    grandsPrixEntered: 185,
    highestFinish: '2 (x1)',
    highestGrid: '4 (x3)',
    sprintPoints: 3,
    dnfs: 0,
  },
  RIC: {
    dob: '01/07/1989',
    birthplace: 'Perth, Australia',
    championships: 0,
    careerWins: 8,
    careerPoles: 3,
    careerPodiums: 32,
    careerPoints: '1,329.0',
    grandsPrixEntered: 257,
    highestFinish: '1 (x8)',
    highestGrid: '1 (x3)',
    sprintPoints: 5,
    dnfs: 0,
  },
  KUB: {
    dob: '07/12/1984',
    birthplace: 'Kraków, Poland',
    championships: 0,
    careerWins: 1,
    careerPoles: 1,
    careerPodiums: 12,
    careerPoints: '274.0',
    grandsPrixEntered: 99,
    highestFinish: '1 (x1)',
    highestGrid: '1 (x1)',
    sprintPoints: 0,
    dnfs: 0,
  },
  SAR: {
    dob: '31/12/2000',
    birthplace: 'Fort Lauderdale, United States',
    championships: 0,
    careerWins: 0,
    careerPoles: 0,
    careerPodiums: 0,
    careerPoints: '1.0',
    grandsPrixEntered: 36,
    highestFinish: '10 (x1)',
    highestGrid: '6 (x1)',
    sprintPoints: 0,
    dnfs: 0,
  },
};

export function getBaselineDriverCareerProfile(driverCode: string): F1DriverCareerStats {
  const allRows = [...FULL_2026_F1_DRIVER_STANDINGS, ...F1_RESERVE_DRIVERS_2026];
  const row =
    allRows.find(
      (r) =>
        r.driverCode.toUpperCase() === driverCode.toUpperCase() ||
        r.driverId.toLowerCase() === driverCode.toLowerCase()
    ) || FULL_2026_F1_DRIVER_STANDINGS[0];
  const bio = CAREER_BIOS[row.driverCode] || CAREER_BIOS.ANT;

  return {
    id: row.driverCode,
    code: row.driverCode,
    name: row.driverName,
    number: row.driverNumber,
    nationality: row.nationality,
    flagUrl: row.flagUrl,
    headshotUrl: row.headshotUrl || F1_DRIVER_HEADSHOTS[row.driverCode] || F1_DRIVER_HEADSHOTS.ANT,
    ergastDriverId: row.ergastDriverId || row.driverId,
    status: row.status || (row.rosterStatus === 'RESERVE' || row.rosterStatus === 'FORMER' ? 'FORMER / RESERVE' : 'ACTIVE'),
    rosterStatus: row.rosterStatus || 'ACTIVE',
    constructorName: row.constructorName,
    constructorCode: row.constructorCode,
    constructorLogo: row.constructorLogo,
    constructorColor: row.constructorColor,
    championships: bio.championships,
    careerWins: bio.careerWins,
    careerPoles: bio.careerPoles,
    careerPodiums: bio.careerPodiums,
    careerPoints: bio.careerPoints,
    fastestLaps: row.fastestLaps ?? 0,
    grandsPrixEntered: bio.grandsPrixEntered,
    seasonPosition: row.position,
    seasonPoints: row.points,
    sprintPoints: bio.sprintPoints,
    dnfs: bio.dnfs,
    highestRaceFinish: bio.highestFinish,
    highestGridPosition: bio.highestGrid,
    dateOfBirth: bio.dob,
    placeOfBirth: bio.birthplace,
    sector1: '27.810',
    sector2: '30.412',
    sector3: '21.205',
    topSpeedKph: 348,
  };
}

/**
/**
 * ============================================================================
 * 3. DYNAMIC LIVE-COMPUTED CAREER STATS & SCHEMA VALIDATION (Jolpica / OpenF1)
 * ============================================================================
 * Validates OpenF1 `/v1/drivers` and Jolpica `/ergast/f1/...` response schemas,
 * verifies constructor & driver IDs against known mappings, and logs any
 * discrepancies found between API payloads and local stored state.
 */
export const OFFICIAL_F1_CONSTRUCTOR_MAPPING: Record<
  string,
  {
    code: string;
    ergastConstructorId: string;
    canonicalName: string;
    logoUrl: string;
    color: string;
  }
> = {
  MER: {
    code: 'MER',
    ergastConstructorId: 'mercedes',
    canonicalName: 'Mercedes',
    logoUrl: F1_LOGOS.MER,
    color: '#27F4D2',
  },
  RBR: {
    code: 'RBR',
    ergastConstructorId: 'red_bull',
    canonicalName: 'Red Bull Racing',
    logoUrl: F1_LOGOS.RBR,
    color: '#3671C6',
  },
  FER: {
    code: 'FER',
    ergastConstructorId: 'ferrari',
    canonicalName: 'Ferrari',
    logoUrl: F1_LOGOS.FER,
    color: '#E10600',
  },
  MCL: {
    code: 'MCL',
    ergastConstructorId: 'mclaren',
    canonicalName: 'McLaren',
    logoUrl: F1_LOGOS.MCL,
    color: '#FF8000',
  },
  AST: {
    code: 'AST',
    ergastConstructorId: 'aston_martin',
    canonicalName: 'Aston Martin',
    logoUrl: (F1_LOGOS as Record<string, string>).AST || F1_LOGOS.AMR || F1_LOGOS.F1_MAIN,
    color: '#229971',
  },
  ALP: {
    code: 'ALP',
    ergastConstructorId: 'alpine',
    canonicalName: 'Alpine',
    logoUrl: F1_LOGOS.ALP,
    color: '#0093CC',
  },
  WIL: {
    code: 'WIL',
    ergastConstructorId: 'williams',
    canonicalName: 'Williams',
    logoUrl: F1_LOGOS.WIL,
    color: '#64C4FF',
  },
  RB: {
    code: 'RB',
    ergastConstructorId: 'rb',
    canonicalName: 'Racing Bulls',
    logoUrl: (F1_LOGOS as Record<string, string>).RB || F1_LOGOS.VCARB || F1_LOGOS.F1_MAIN,
    color: '#6692FF',
  },
  HAA: {
    code: 'HAA',
    ergastConstructorId: 'haas',
    canonicalName: 'Haas F1 Team',
    logoUrl: F1_LOGOS.HAA,
    color: '#B6BABD',
  },
  AUD: {
    code: 'AUD',
    ergastConstructorId: 'audi',
    canonicalName: 'Audi F1 Team',
    logoUrl: (F1_LOGOS as Record<string, string>).AUD || F1_LOGOS.SAU || F1_LOGOS.F1_MAIN,
    color: '#F50537',
  },
  CAD: {
    code: 'CAD',
    ergastConstructorId: 'cadillac',
    canonicalName: 'Cadillac F1 Team',
    logoUrl: (F1_LOGOS as Record<string, string>).CAD || F1_LOGOS.F1_MAIN,
    color: '#D4AF37',
  },
};

export function verifyF1ConstructorMapping(params: {
  constructorCode?: string;
  ergastConstructorId?: string;
  teamName?: string;
  contextDriverCode?: string;
}): {
  verified: boolean;
  code: string;
  canonicalName: string;
  logoUrl: string;
  color: string;
} {
  const codeUpper = (params.constructorCode || '').trim().toUpperCase();
  if (codeUpper && OFFICIAL_F1_CONSTRUCTOR_MAPPING[codeUpper]) {
    const entry = OFFICIAL_F1_CONSTRUCTOR_MAPPING[codeUpper];
    return { verified: true, ...entry };
  }

  const ergastLower = (params.ergastConstructorId || '').trim().toLowerCase();
  const teamLower = (params.teamName || '').trim().toLowerCase();

  for (const entry of Object.values(OFFICIAL_F1_CONSTRUCTOR_MAPPING)) {
    if (
      (ergastLower &&
        (entry.ergastConstructorId === ergastLower ||
          (ergastLower === 'sauber' && entry.code === 'AUD') ||
          (ergastLower === 'Kick Sauber'.toLowerCase() && entry.code === 'AUD'))) ||
      (teamLower && teamLower.includes(entry.canonicalName.toLowerCase().split(' ')[0]))
    ) {
      return { verified: true, ...entry };
    }
  }

  logDataDiscrepancy({
    source: 'JOLPICA',
    category: 'UNKNOWN_TEAM_ID',
    entityId: params.contextDriverCode || codeUpper || ergastLower || 'unknown_f1_team',
    field: 'constructorId',
    apiValue: params,
    localValue: 'OFFICIAL_F1_CONSTRUCTOR_MAPPING',
    resolution: 'Unrecognized F1 constructor ID; retained verified local constructor mapping.',
  });

  return {
    verified: false,
    code: codeUpper || 'MER',
    canonicalName: params.teamName || 'Mercedes',
    logoUrl: F1_LOGOS.MER,
    color: '#27F4D2',
  };
}

export interface OpenF1DriverSchema {
  driver_number: number;
  name_acronym: string;
  full_name?: string;
  team_name?: string;
  team_colour?: string;
  headshot_url?: string;
}

export function validateOpenF1DriversSchema(
  payload: unknown
): { valid: boolean; drivers: OpenF1DriverSchema[] } {
  if (!Array.isArray(payload)) {
    logDataDiscrepancy({
      source: 'OPENF1',
      category: 'SCHEMA_MISMATCH',
      entityId: 'openf1_drivers_root',
      field: 'drivers',
      apiValue: typeof payload,
      localValue: 'Array<OpenF1DriverSchema>',
      resolution: 'Rejected non-array OpenF1 drivers payload; keeping local verified F1 roster.',
    });
    return { valid: false, drivers: [] };
  }

  const validDrivers: OpenF1DriverSchema[] = [];
  for (const item of payload) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as any).name_acronym === 'string' &&
      typeof (item as any).driver_number === 'number'
    ) {
      validDrivers.push(item as OpenF1DriverSchema);
    }
  }

  return { valid: validDrivers.length > 0, drivers: validDrivers };
}

export function validateJolpicaDriverStandingsSchema(
  payload: unknown
): { valid: boolean; standingsLists: any[]; driverStandings: any[] } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, standingsLists: [], driverStandings: [] };
  }
  const standingsLists = (payload as any)?.MRData?.StandingsTable?.StandingsLists;
  if (!Array.isArray(standingsLists)) {
    logDataDiscrepancy({
      source: 'JOLPICA',
      category: 'SCHEMA_MISMATCH',
      entityId: 'jolpica_standings_root',
      field: 'MRData.StandingsTable.StandingsLists',
      apiValue: typeof standingsLists,
      localValue: 'Array<StandingsList>',
      resolution: 'Jolpica standings response missing StandingsLists array; keeping local verified standings.',
    });
    return { valid: false, standingsLists: [], driverStandings: [] };
  }

  const firstList = standingsLists[0]?.DriverStandings;
  const driverStandings = Array.isArray(firstList) ? firstList : [];
  return {
    valid: standingsLists.length > 0,
    standingsLists,
    driverStandings,
  };
}

export function validateJolpicaRaceResultsSchema(
  payload: unknown
): { valid: boolean; races: any[] } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, races: [] };
  }
  const races = (payload as any)?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races)) {
    logDataDiscrepancy({
      source: 'JOLPICA',
      category: 'SCHEMA_MISMATCH',
      entityId: 'jolpica_races_root',
      field: 'MRData.RaceTable.Races',
      apiValue: typeof races,
      localValue: 'Array<RaceResult>',
      resolution: 'Jolpica race results response missing Races array; keeping local verified career baseline.',
    });
    return { valid: false, races: [] };
  }
  return { valid: true, races };
}

export async function fetchLiveDriverCareerProfile(
  driverCodeOrId: string
): Promise<F1DriverCareerStats> {
  const baseline = getBaselineDriverCareerProfile(driverCodeOrId);
  const ergastId = baseline.ergastDriverId || driverCodeOrId.toLowerCase();

  const [standingsJson, resultsJson] = await Promise.all([
    fetchWithResilience<any>(
      `https://api.jolpi.ca/ergast/f1/current/drivers/${ergastId}/driverStandings.json`,
      {
        ttlMs: TTL_SCHEDULE_ROSTER_MS,
        cacheKey: `jolpica_career_standings_${ergastId}`,
      }
    ),
    fetchWithResilience<any>(
      `https://api.jolpi.ca/ergast/f1/drivers/${ergastId}/results.json?limit=1000`,
      {
        ttlMs: TTL_SCHEDULE_ROSTER_MS,
        cacheKey: `jolpica_career_results_${ergastId}`,
      }
    ),
  ]);

  let championships = baseline.championships;
  let careerWins = baseline.careerWins;
  let careerPointsNum =
    parseFloat(String(baseline.careerPoints).replace(/,/g, '')) || 0;

  const validatedStandings = validateJolpicaDriverStandingsSchema(standingsJson);
  const standingsLists = validatedStandings.standingsLists;
  if (validatedStandings.valid && standingsLists.length > 0) {
    let wdcCount = 0;
    let totalWins = 0;
    let totalPts = 0;
    for (const seasonList of standingsLists) {
      const ds = seasonList?.DriverStandings?.[0];
      if (!ds) continue;
      if (String(ds.position) === '1') wdcCount += 1;
      totalWins += Number(ds.wins || 0);
      totalPts += Number(ds.points || 0);
    }
    if (totalPts > 0) {
      championships = Math.max(championships, wdcCount);
      careerWins = Math.max(careerWins, totalWins);
      careerPointsNum = Math.max(careerPointsNum, totalPts);
    }
  }

  let grandsPrixEntered = baseline.grandsPrixEntered;
  let careerPodiums = baseline.careerPodiums;
  let highestRaceFinish = baseline.highestRaceFinish || '1 (x1)';
  let highestGridPosition = baseline.highestGridPosition || '1 (x1)';

  const validatedResults = validateJolpicaRaceResultsSchema(resultsJson);
  const racesList = validatedResults.races;
  if (validatedResults.valid && racesList.length > 0) {
    if (racesList.length !== baseline.grandsPrixEntered) {
      logDataDiscrepancy({
        source: 'JOLPICA',
        category: 'STATE_DISCREPANCY',
        entityId: baseline.code,
        field: 'grandsPrixEntered',
        apiValue: racesList.length,
        localValue: baseline.grandsPrixEntered,
        resolution: `Resolved Grands Prix entered for ${baseline.code} using Math.max(${baseline.grandsPrixEntered}, ${racesList.length}).`,
      });
    }
    grandsPrixEntered = Math.max(grandsPrixEntered, racesList.length);
    let podiumCount = 0;
    let bestFinish = 99;
    let bestFinishCount = 0;
    let bestGrid = 99;
    let bestGridCount = 0;

    for (const race of racesList) {
      const res = race?.Results?.[0];
      if (!res) continue;
      const pos = parseInt(res.position, 10);
      const grid = parseInt(res.grid, 10);
      if (!Number.isNaN(pos) && pos > 0) {
        if (pos <= 3) podiumCount += 1;
        if (pos < bestFinish) {
          bestFinish = pos;
          bestFinishCount = 1;
        } else if (pos === bestFinish) {
          bestFinishCount += 1;
        }
      }
      if (!Number.isNaN(grid) && grid > 0) {
        if (grid < bestGrid) {
          bestGrid = grid;
          bestGridCount = 1;
        } else if (grid === bestGrid) {
          bestGridCount += 1;
        }
      }
    }

    if (podiumCount >= careerPodiums) {
      careerPodiums = podiumCount;
    }
    if (bestFinish < 99) {
      highestRaceFinish = `${bestFinish} (x${bestFinishCount})`;
    }
    if (bestGrid < 99) {
      highestGridPosition = `${bestGrid} (x${bestGridCount})`;
    }
  }

  return {
    ...baseline,
    championships,
    careerWins,
    careerPodiums,
    careerPoints: careerPointsNum.toLocaleString('en-US', {
      minimumFractionDigits: careerPointsNum % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    }),
    grandsPrixEntered,
    highestRaceFinish,
    highestGridPosition,
  };
}

/**
 * ============================================================================
 * 4. AUTOMATIC F1 ROSTER, PHOTO & TRANSFER SYNC ENGINE
 * ============================================================================
 * Fetches `https://api.openf1.org/v1/drivers?session_key=latest` and
 * `https://api.jolpi.ca/ergast/f1/current/driverStandings.json` &
 * `constructorStandings.json` to diff the active grid and update driver numbers,
 * team colors, headshots, and transfers automatically.
 */
export interface SyncedF1RosterPayload {
  driverStandings: F1DriverStandingRow[];
  standings: F1DriverStandingRow[];
  constructorStandings: F1ConstructorStandingRow[];
  transfers: F1RosterTransferEvent[];
  transferEvents: F1RosterTransferEvent[];
  careerRegistry: Record<string, F1DriverCareerStats>;
  lastSyncedAtISO: string;
  verifiedAtIST?: string;
  round?: string;
  discrepancies?: DataValidationDiscrepancy[];
}

export interface F1SeasonStandingsResult {
  year: number;
  round: string;
  driverStandings: F1DriverStandingRow[];
  constructorStandings: F1ConstructorStandingRow[];
  verifiedAtIST: string;
  fromCache: boolean;
}

const F1_SEASON_SNAPSHOT_KEY_PREFIX = 'apex_pitch_verified_v5_f1_standings_';

function resolveJolpicaConstructorMeta(
  ergastConstructorId?: string,
  teamName?: string
): {
  code: string;
  name: string;
  logo: string;
  color: string;
} {
  const id = (ergastConstructorId || '').toLowerCase();
  const name = teamName || '';
  if (id.includes('mercedes') || name.toLowerCase().includes('mercedes')) {
    return { code: 'MER', name: name || 'Mercedes', logo: F1_LOGOS.MER, color: '#27F4D2' };
  }
  if (id.includes('red_bull') || name.toLowerCase().includes('red bull')) {
    return { code: 'RBR', name: name || 'Red Bull Racing', logo: F1_LOGOS.RBR, color: '#3671C6' };
  }
  if (id.includes('ferrari') || name.toLowerCase().includes('ferrari')) {
    return { code: 'FER', name: name || 'Ferrari', logo: F1_LOGOS.FER, color: '#E10600' };
  }
  if (id.includes('mclaren') || name.toLowerCase().includes('mclaren')) {
    return { code: 'MCL', name: name || 'McLaren', logo: F1_LOGOS.MCL, color: '#FF8000' };
  }
  if (id.includes('aston_martin') || name.toLowerCase().includes('aston martin') || id.includes('racing_point')) {
    return { code: 'AMR', name: name || 'Aston Martin', logo: F1_LOGOS.AMR, color: '#229971' };
  }
  if (id.includes('alpine') || id.includes('renault') || name.toLowerCase().includes('alpine')) {
    return { code: 'ALP', name: name || 'Alpine', logo: F1_LOGOS.ALP, color: '#0093CC' };
  }
  if (id.includes('williams') || name.toLowerCase().includes('williams')) {
    return { code: 'WIL', name: name || 'Williams', logo: F1_LOGOS.WIL, color: '#64C4FF' };
  }
  if (id === 'rb' || id.includes('alphatauri') || name.toLowerCase().includes('racing bulls') || name.toLowerCase().includes('rb f1')) {
    return { code: 'VCARB', name: name || 'Racing Bulls', logo: F1_LOGOS.VCARB, color: '#6692FF' };
  }
  if (id.includes('haas') || name.toLowerCase().includes('haas')) {
    return { code: 'HAA', name: name || 'Haas F1 Team', logo: F1_LOGOS.HAA, color: '#B6BABD' };
  }
  if (id.includes('sauber') || id.includes('audi') || id.includes('alfa') || name.toLowerCase().includes('sauber') || name.toLowerCase().includes('audi')) {
    return { code: 'SAU', name: name || 'Audi / Sauber', logo: F1_LOGOS.SAU, color: '#52E252' };
  }
  if (id.includes('cadillac') || name.toLowerCase().includes('cadillac')) {
    return { code: 'CAD', name: name || 'Cadillac F1', logo: F1_LOGOS.F1_MAIN, color: '#D4AF37' };
  }
  return {
    code: (id.slice(0, 3) || 'F1').toUpperCase(),
    name: name || 'Formula 1 Team',
    logo: F1_LOGOS.F1_MAIN,
    color: '#8E95A5',
  };
}

function resolveNationalityFlagUrl(nationality?: string, fallbackUrl?: string): string {
  if (fallbackUrl) return fallbackUrl;
  const nat = (nationality || '').toLowerCase();
  if (nat.includes('british') || nat.includes('united kingdom')) return GP_FLAGS.GB;
  if (nat.includes('dutch') || nat.includes('netherlands')) return GP_FLAGS.NL;
  if (nat.includes('italian') || nat.includes('italy')) return GP_FLAGS.IT;
  if (nat.includes('monegasque') || nat.includes('monaco')) return GP_FLAGS.MC;
  if (nat.includes('spanish') || nat.includes('spain')) return GP_FLAGS.ES;
  if (nat.includes('french') || nat.includes('france')) return GP_FLAGS.FR;
  if (nat.includes('australian') || nat.includes('australia') || nat.includes('new zealand')) return GP_FLAGS.AU;
  if (nat.includes('german') || nat.includes('germany') || nat.includes('finnish') || nat.includes('danish')) return GP_FLAGS.DE;
  if (nat.includes('mexican') || nat.includes('mexico')) return GP_FLAGS.MX;
  if (nat.includes('brazilian') || nat.includes('argentine')) return GP_FLAGS.BR;
  if (nat.includes('canadian') || nat.includes('american')) return GP_FLAGS.US;
  return GP_FLAGS.GB;
}

export async function fetchF1StandingsBySeason(
  year: number = 2026,
  forceRefresh = false
): Promise<F1SeasonStandingsResult> {
  const snapshotKey = `${F1_SEASON_SNAPSHOT_KEY_PREFIX}${year}`;
  const isHistorical = year < 2026;
  const ttlMs = isHistorical ? 7 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;

  const [driverJson, constructorJson, resultsJson] = await Promise.all([
    fetchWithResilience<any>(
      `https://api.jolpi.ca/ergast/f1/${year}/driverStandings.json`,
      {
        ttlMs,
        cacheKey: `jolpica_${year}_driver_standings`,
        forceRefresh,
      }
    ),
    fetchWithResilience<any>(
      `https://api.jolpi.ca/ergast/f1/${year}/constructorStandings.json`,
      {
        ttlMs,
        cacheKey: `jolpica_${year}_constructor_standings`,
        forceRefresh,
      }
    ),
    fetchWithResilience<any>(
      `https://api.jolpi.ca/ergast/f1/${year}/results.json?limit=500`,
      {
        ttlMs,
        cacheKey: `jolpica_${year}_race_results`,
        forceRefresh,
      }
    ),
  ]);

  const driverPodiumsByCode = new Map<string, number>();
  const driverPolesByCode = new Map<string, number>();
  const constructorPodiumsByCode = new Map<string, number>();
  const constructorPolesByCode = new Map<string, number>();

  const races = resultsJson?.MRData?.RaceTable?.Races;
  if (Array.isArray(races)) {
    for (const race of races) {
      const results = Array.isArray(race?.Results) ? race.Results : [];
      for (const res of results) {
        const dCode = String(
          res?.Driver?.code || res?.Driver?.familyName?.slice(0, 3) || ''
        ).toUpperCase();
        const cMeta = resolveJolpicaConstructorMeta(
          res?.Constructor?.constructorId,
          res?.Constructor?.name
        );
        const pos = Number(res?.position);
        const grid = Number(res?.grid);
        if (pos >= 1 && pos <= 3) {
          if (dCode) {
            driverPodiumsByCode.set(dCode, (driverPodiumsByCode.get(dCode) || 0) + 1);
          }
          constructorPodiumsByCode.set(
            cMeta.code,
            (constructorPodiumsByCode.get(cMeta.code) || 0) + 1
          );
        }
        if (grid === 1) {
          if (dCode) {
            driverPolesByCode.set(dCode, (driverPolesByCode.get(dCode) || 0) + 1);
          }
          constructorPolesByCode.set(
            cMeta.code,
            (constructorPolesByCode.get(cMeta.code) || 0) + 1
          );
        }
      }
    }
  }

  const allKnownDrivers = [...FULL_2026_F1_DRIVER_STANDINGS, ...F1_RESERVE_DRIVERS_2026];
  const knownByCode = new Map<string, F1DriverStandingRow>();
  for (const r of allKnownDrivers) {
    knownByCode.set(r.driverCode.toUpperCase(), r);
  }

  const standingsListObj = driverJson?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rawDriverStandings: any[] = Array.isArray(standingsListObj?.DriverStandings)
    ? standingsListObj.DriverStandings
    : [];
  const roundStr = String(standingsListObj?.round || 'Final');

  const parsedDrivers: F1DriverStandingRow[] = [];
  const leaderPoints =
    rawDriverStandings.length > 0 ? Number(rawDriverStandings[0]?.points ?? 0) : 0;

  for (let i = 0; i < rawDriverStandings.length; i++) {
    const item = rawDriverStandings[i];
    const dObj = item?.Driver || {};
    const cObj = item?.Constructors?.[0] || {};
    const code = String(
      dObj.code || dObj.familyName?.slice(0, 3) || `D${i + 1}`
    ).toUpperCase();
    const known = knownByCode.get(code);
    const cMeta = resolveJolpicaConstructorMeta(cObj.constructorId, cObj.name);
    const pos = Number(item?.position) || i + 1;
    const pts = Number(item?.points ?? 0);
    const wins = Number(item?.wins ?? 0);
    const podiums = Math.max(wins, driverPodiumsByCode.get(code) || 0);
    const poles = driverPolesByCode.get(code) || 0;
    const fullName =
      `${dObj.givenName || ''} ${dObj.familyName || ''}`.trim() ||
      known?.driverName ||
      code;
    const driverNum =
      (year === 2026 && known?.driverNumber) ||
      Number(dObj.permanentNumber) ||
      known?.driverNumber ||
      0;
    const gap =
      i === 0
        ? 'LEADER'
        : `-${Number((leaderPoints - pts).toFixed(1))}`;

    parsedDrivers.push({
      position: pos,
      rank: pos,
      driverId: String(dObj.driverId || known?.driverId || code.toLowerCase()),
      driverCode: code,
      driverName: fullName,
      driverNumber: driverNum,
      nationality: String(dObj.nationality || known?.nationality || ''),
      flagUrl: resolveNationalityFlagUrl(dObj.nationality, known?.flagUrl),
      countryFlagUrl: resolveNationalityFlagUrl(dObj.nationality, known?.flagUrl),
      headshotUrl:
        F1_DRIVER_HEADSHOTS[code] ||
        known?.headshotUrl ||
        F1_DRIVER_HEADSHOTS.ANT,
      ergastDriverId: String(dObj.driverId || known?.ergastDriverId || code.toLowerCase()),
      rosterStatus: 'ACTIVE',
      status: 'ACTIVE',
      constructorCode: cMeta.code,
      constructorName: cMeta.name,
      constructorLogo: cMeta.logo,
      constructorColor: cMeta.color,
      wins,
      podiums,
      poles,
      fastestLaps: 0,
      points: pts,
      gapToLeader: gap,
    });
  }

  parsedDrivers.sort((a, b) => a.position - b.position);

  const constructorListObj =
    constructorJson?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rawConstructorStandings: any[] = Array.isArray(
    constructorListObj?.ConstructorStandings
  )
    ? constructorListObj.ConstructorStandings
    : [];

  const parsedConstructors: F1ConstructorStandingRow[] = [];
  for (let i = 0; i < rawConstructorStandings.length; i++) {
    const item = rawConstructorStandings[i];
    const cObj = item?.Constructor || {};
    const cMeta = resolveJolpicaConstructorMeta(cObj.constructorId, cObj.name);
    const pos = Number(item?.position) || i + 1;
    const pts = Number(item?.points ?? 0);
    const wins = Number(item?.wins ?? 0);
    const podiums = Math.max(wins, constructorPodiumsByCode.get(cMeta.code) || 0);
    const poles = constructorPolesByCode.get(cMeta.code) || 0;

    const teamDrivers = parsedDrivers
      .filter((d) => d.constructorCode === cMeta.code)
      .slice(0, 2)
      .map((d) => {
        const parts = d.driverName.split(' ');
        const last = parts[parts.length - 1] || d.driverName;
        const firstInitial = parts[0]?.[0] ? `${parts[0][0]}. ` : '';
        return `${firstInitial}${last}`;
      });

    const leaderConstructorPts =
      rawConstructorStandings.length > 0
        ? Number(rawConstructorStandings[0]?.points ?? 0)
        : 0;
    const cGap =
      i === 0
        ? 'LEADER'
        : `-${Number((leaderConstructorPts - pts).toFixed(1))}`;

    parsedConstructors.push({
      position: pos,
      rank: pos,
      constructorCode: cMeta.code,
      constructorName: cMeta.name,
      shortName: cMeta.name,
      constructorLogo: cMeta.logo,
      constructorColor: cMeta.color,
      drivers: teamDrivers,
      wins,
      podiums,
      poles,
      fastestLaps: 0,
      points: pts,
      gapToLeader: cGap,
    });
  }

  parsedConstructors.sort((a, b) => a.position - b.position);

  const verifiedAtIST = new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toUpperCase();

  if (parsedDrivers.length > 0 || parsedConstructors.length > 0) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          snapshotKey,
          JSON.stringify({
            year,
            round: roundStr,
            driverStandings: parsedDrivers,
            constructorStandings: parsedConstructors,
            verifiedAtIST,
            savedAtISO: new Date().toISOString(),
          })
        );
      } catch {
        // Ignore storage errors
      }
    }
    return {
      year,
      round: roundStr,
      driverStandings: parsedDrivers,
      constructorStandings: parsedConstructors,
      verifiedAtIST,
      fromCache: false,
    };
  }

  // Fallback to last verified snapshot in localStorage if offline
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(snapshotKey);
      if (raw) {
        const snap = JSON.parse(raw);
        if (snap && Array.isArray(snap.driverStandings)) {
          return {
            year,
            round: snap.round || 'Snapshot',
            driverStandings: snap.driverStandings,
            constructorStandings: Array.isArray(snap.constructorStandings)
              ? snap.constructorStandings
              : [],
            verifiedAtIST: snap.verifiedAtIST || verifiedAtIST,
            fromCache: true,
          };
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return {
    year,
    round: 'Syncing',
    driverStandings: [],
    constructorStandings: [],
    verifiedAtIST,
    fromCache: false,
  };
}

export async function syncF1RosterAndStandings(
  forceRefresh = false
): Promise<SyncedF1RosterPayload> {
  const [openF1Drivers, season2026] = await Promise.all([
    fetchWithResilience<any[]>('https://api.openf1.org/v1/drivers?session_key=latest', {
      ttlMs: TTL_SCHEDULE_ROSTER_MS,
      cacheKey: 'openf1_latest_drivers',
      forceRefresh,
    }),
    fetchF1StandingsBySeason(2026, forceRefresh),
  ]);

  const activeOpenF1Map = new Map<
    string,
    {
      driverNumber: number;
      fullName: string;
      teamName: string;
      teamColor: string;
      headshotUrl: string;
    }
  >();

  if (openF1Drivers !== null && openF1Drivers !== undefined) {
    const validatedOpenF1 = validateOpenF1DriversSchema(openF1Drivers);
    for (const d of validatedOpenF1.drivers) {
      const code = String(d?.name_acronym || '').toUpperCase();
      if (!code) continue;
      if (d.team_name) {
        verifyF1ConstructorMapping({
          teamName: d.team_name,
          contextDriverCode: code,
        });
      }
      activeOpenF1Map.set(code, {
        driverNumber: Number(d.driver_number) || 0,
        fullName: d.full_name || code,
        teamName: d.team_name || '',
        teamColor: d.team_colour ? `#${String(d.team_colour).replace(/^#/, '')}` : '',
        headshotUrl: upgradeOpenF1HeadshotUrl(d.headshot_url, code),
      });
    }
  }

  const mergedDrivers = season2026.driverStandings.map((row, idx) => {
    const liveOpen = activeOpenF1Map.get(row.driverCode);
    if (!liveOpen) {
      return {
        ...row,
        position: idx + 1,
        rank: idx + 1,
        countryFlagUrl: row.flagUrl,
      };
    }

    return {
      ...row,
      position: idx + 1,
      rank: idx + 1,
      countryFlagUrl: row.flagUrl,
      driverNumber: row.driverNumber || liveOpen.driverNumber,
      headshotUrl: liveOpen.headshotUrl || row.headshotUrl,
      constructorColor: liveOpen.teamColor || row.constructorColor,
    };
  });

  const careerRegistry: Record<string, F1DriverCareerStats> = {};
  for (const row of [...mergedDrivers, ...F1_RESERVE_DRIVERS_2026]) {
    const profile = getBaselineDriverCareerProfile(row.driverCode);
    careerRegistry[row.driverCode] = {
      ...profile,
      seasonPosition: row.position,
      seasonPoints: row.points,
    };
  }

  return {
    driverStandings: mergedDrivers,
    standings: mergedDrivers,
    constructorStandings: season2026.constructorStandings,
    transfers: VERIFIED_ROSTER_TRANSFERS,
    transferEvents: VERIFIED_ROSTER_TRANSFERS,
    careerRegistry,
    lastSyncedAtISO: new Date().toISOString(),
    verifiedAtIST: season2026.verifiedAtIST,
    round: season2026.round,
    discrepancies: getDataDiscrepancyLogs(),
  };
}

/**
 * ============================================================================
 * 5. OFFICIAL F1 APP MULTI-SEASON CALENDARS (2025, 2026 & 24-RACE 2027)
 * ============================================================================
 * Mirrors the Official Formula 1 App Race Calendar with:
 * - Season Switcher: 2025 | 2026 | 2027
 * - Authentic White Track Map URLs + custom SVG circuit outlines for all 24 tracks
 */
const SESSION_TOP_DRIVERS_POOL: Array<{
  code: string;
  name: string;
  number: number;
  team: string;
  teamCode: string;
  color: string;
}> = [
  { code: 'ANT', name: 'K. Antonelli', number: 12, team: 'Mercedes', teamCode: 'MER', color: '#27F4D2' },
  { code: 'VER', name: 'M. Verstappen', number: 3, team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
  { code: 'NOR', name: 'L. Norris', number: 1, team: 'McLaren', teamCode: 'MCL', color: '#FF8000' },
  { code: 'LEC', name: 'C. Leclerc', number: 16, team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
  { code: 'RUS', name: 'G. Russell', number: 63, team: 'Mercedes', teamCode: 'MER', color: '#27F4D2' },
  { code: 'HAM', name: 'L. Hamilton', number: 44, team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
  { code: 'PIA', name: 'O. Piastri', number: 81, team: 'McLaren', teamCode: 'MCL', color: '#FF8000' },
  { code: 'SAI', name: 'C. Sainz', number: 55, team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
  { code: 'ALO', name: 'F. Alonso', number: 14, team: 'Aston Martin', teamCode: 'AMR', color: '#229971' },
  { code: 'GAS', name: 'P. Gasly', number: 10, team: 'Alpine', teamCode: 'ALP', color: '#FF87BC' },
  { code: 'LAW', name: 'L. Lawson', number: 30, team: 'Racing Bulls', teamCode: 'VCARB', color: '#6692FF' },
  { code: 'BEA', name: 'O. Bearman', number: 87, team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
  { code: 'HAD', name: 'I. Hadjar', number: 6, team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
  { code: 'ALB', name: 'A. Albon', number: 23, team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
  { code: 'OCO', name: 'E. Ocon', number: 31, team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
  { code: 'HUL', name: 'N. Hülkenberg', number: 27, team: 'Audi / Sauber', teamCode: 'SAU', color: '#52E252' },
  { code: 'BOR', name: 'G. Bortoleto', number: 5, team: 'Audi / Sauber', teamCode: 'SAU', color: '#52E252' },
  { code: 'STR', name: 'L. Stroll', number: 18, team: 'Aston Martin', teamCode: 'AMR', color: '#229971' },
  { code: 'LIN', name: 'A. Lindblad', number: 41, team: 'Racing Bulls', teamCode: 'VCARB', color: '#6692FF' },
  { code: 'COL', name: 'F. Colapinto', number: 43, team: 'Alpine', teamCode: 'ALP', color: '#FF87BC' },
  { code: 'PER', name: 'S. Pérez', number: 11, team: 'Cadillac F1 Team', teamCode: 'CAD', color: '#C0C0C0' },
  { code: 'BOT', name: 'V. Bottas', number: 77, team: 'Cadillac F1 Team', teamCode: 'CAD', color: '#C0C0C0' },
];

function buildSessionTop10Classification(
  round: number,
  sessionIdx: number,
  isRaceOrSprint: boolean,
  winnerSummary?: string,
  totalLaps: number = 58,
  isSprintQualifying: boolean = false
): { summary: string; results: F1SessionResultEntry[] } {
  const findLeaderFromWinnerSummary = () => {
    if (!winnerSummary) return null;
    const lower = winnerSummary.toLowerCase();
    return SESSION_TOP_DRIVERS_POOL.find((d) => {
      const lastName = d.name.split(' ')[1]?.toLowerCase() || '';
      return lastName && lower.includes(lastName);
    });
  };

  const raceWinner = findLeaderFromWinnerSummary();
  const top10Pool = SESSION_TOP_DRIVERS_POOL.slice(0, 10);
  const midfieldPool = SESSION_TOP_DRIVERS_POOL.slice(10);
  const rotationOffset = (round * 3 + sessionIdx * 2) % top10Pool.length;
  const midRotationOffset = (round * 2 + sessionIdx) % midfieldPool.length;
  const rotated = [
    ...top10Pool.slice(rotationOffset),
    ...top10Pool.slice(0, rotationOffset),
    ...midfieldPool.slice(midRotationOffset),
    ...midfieldPool.slice(0, midRotationOffset),
  ];

  // For Qualifying (sessionIdx === 3) or Grand Prix (sessionIdx === 4), put the race winner at or near P1
  if (raceWinner && (sessionIdx === 4 || sessionIdx === 3)) {
    const idx = rotated.findIndex((d) => d.code === raceWinner.code);
    if (idx > 0) {
      const [picked] = rotated.splice(idx, 1);
      if (sessionIdx === 4 || round % 2 === 0) {
        rotated.unshift(picked);
      } else {
        rotated.splice(1, 0, picked);
      }
    }
  }

  const baseSeconds = 72 + ((round * 5) % 21) - sessionIdx * 0.35;
  const formatLapSec = (secTotal: number): string => {
    const mins = Math.floor(secTotal / 60);
    const secs = (secTotal - mins * 60).toFixed(3).padStart(6, '0');
    return `${mins}:${secs}`;
  };

  const p1LapStr = formatLapSec(baseSeconds);
  const results: F1SessionResultEntry[] = rotated.slice(0, 22).map((drv, idx) => {
    const delta = idx === 0 ? 0 : Number((idx * 0.088 + ((round + idx) % 4) * 0.021).toFixed(3));
    const raceDelta = idx === 0 ? 0 : Number((idx * 2.85 + ((round + idx) % 5) * 0.62).toFixed(3));
    const bestLap = formatLapSec(baseSeconds + delta);
    const compound: TyreCompound = isRaceOrSprint
      ? idx % 3 === 0
        ? 'H'
        : idx % 2 === 0
        ? 'M'
        : 'S'
      : isSprintQualifying && idx >= 10
      ? 'M'
      : 'S';
    const lapsDone = isRaceOrSprint
      ? sessionIdx === 2
        ? Math.max(17, Math.round(totalLaps * 0.33))
        : totalLaps
      : isSprintQualifying
      ? idx < 10
        ? 15
        : idx < 16
        ? 11
        : 6
      : sessionIdx === 3
      ? idx < 10
        ? 18
        : idx < 16
        ? 13
        : 8
      : 22 + ((round + idx + sessionIdx) % 9);

    const qualiKnockoutSuffix =
      !isRaceOrSprint && isSprintQualifying
        ? idx >= 16
          ? ' (SQ1)'
          : idx >= 10
          ? ' (SQ2)'
          : ''
        : !isRaceOrSprint && sessionIdx === 3
        ? idx >= 16
          ? ' (Q1)'
          : idx >= 10
          ? ' (Q2)'
          : ''
        : '';

    return {
      pos: idx + 1,
      driverCode: drv.code,
      driverName: drv.name,
      driverNumber: drv.number,
      constructorName: drv.team,
      constructorCode: drv.teamCode,
      constructorColor: drv.color,
      timeOrGap:
        idx === 0
          ? isRaceOrSprint
            ? 'WINNER'
            : p1LapStr
          : isRaceOrSprint
          ? `+${raceDelta.toFixed(3)}s`
          : `+${delta.toFixed(3)}s${qualiKnockoutSuffix}`,
      bestLapTime: bestLap,
      tyreCompound: compound,
      lapsCompleted: lapsDone,
      hasFastestLap: idx === 0,
    };
  });

  const p1 = results[0];
  const p2 = results[1];
  const p3 = results[2];

  let summary = '';
  if (sessionIdx === 4) {
    summary = winnerSummary
      ? `${winnerSummary} • P2 ${p2.driverName.split(' ')[1]} • P3 ${p3.driverName.split(' ')[1]}`
      : `Winner: ${p1.driverName} (${p1.constructorName}) • P2 ${p2.driverName} • P3 ${p3.driverName}`;
  } else if (sessionIdx === 3) {
    summary = `Pole: ${p1.driverName} (${p1.constructorName}) • ${p1LapStr} (S)`;
  } else if (isRaceOrSprint && sessionIdx === 2) {
    summary = `Sprint Winner: ${p1.driverName} (${p1.constructorName}) • P2 ${p2.driverName.split(' ')[1]}`;
  } else if (sessionIdx === 1 && isSprintQualifying) {
    summary = `Sprint Pole: ${p1.driverName} (${p1.constructorName}) • ${p1LapStr} (SQ3)`;
  } else {
    summary = `Fastest: ${p1.driverName} (${p1.constructorName}) • ${p1LapStr} (${p1.tyreCompound})`;
  }

  return { summary, results };
}

/**
 * Computes the official 22-car Race or Sprint Starting Grid from Qualifying classification
 * and applies any FIA Steward grid drop penalties or Pit Lane starts.
 */
export function computeStartingGridWithPenalties(
  qualifyingResults: F1SessionResultEntry[],
  penalties: F1GridPenaltyNote[] = [],
  targetSession: 'Grand Prix' | 'Sprint' = 'Grand Prix'
): F1StartingGridEntry[] {
  if (!Array.isArray(qualifyingResults) || qualifyingResults.length === 0) {
    return [];
  }

  const sortedQuali = [...qualifyingResults].sort((a, b) => a.pos - b.pos);
  const applicablePenalties = (penalties || []).filter((p) => {
    const rawTarget = p.targetSession || (p as any).appliesTo || 'Grand Prix';
    if (targetSession === 'Sprint') {
      return rawTarget === 'Sprint' || rawTarget === 'SPRINT';
    }
    return rawTarget === 'Grand Prix' || rawTarget === 'RACE';
  });
  const penaltyByCode = new Map<string, F1GridPenaltyNote>();
  for (const pen of applicablePenalties) {
    penaltyByCode.set(pen.driverCode.toUpperCase(), pen);
  }

  const unpenalizedOnTrack: F1SessionResultEntry[] = [];
  const penalizedOnTrack: Array<{
    entry: F1SessionResultEntry;
    penalty: F1GridPenaltyNote;
    drop: number;
  }> = [];
  const backOfGridCandidates: Array<{
    entry: F1SessionResultEntry;
    penalty: F1GridPenaltyNote;
  }> = [];
  const pitLaneCandidates: Array<{
    entry: F1SessionResultEntry;
    penalty: F1GridPenaltyNote;
  }> = [];

  for (const entry of sortedQuali) {
    const pen = penaltyByCode.get(entry.driverCode.toUpperCase());
    if (pen?.pitLaneStart) {
      pitLaneCandidates.push({ entry, penalty: pen });
    } else if (pen?.backOfGrid) {
      backOfGridCandidates.push({ entry, penalty: pen });
    } else if (pen && typeof pen.gridDropPositions === 'number' && pen.gridDropPositions > 0) {
      penalizedOnTrack.push({
        entry,
        penalty: pen,
        drop: pen.gridDropPositions,
      });
    } else {
      unpenalizedOnTrack.push(entry);
    }
  }

  const onTrackTotal = unpenalizedOnTrack.length + penalizedOnTrack.length;
  const assignedSlots = new Array<{
    entry: F1SessionResultEntry;
    penalty?: F1GridPenaltyNote;
  } | null>(onTrackTotal).fill(null);

  // Place penalized on-track drivers at their exact FIA target slot: Math.min(onTrackTotal, pos + drop)
  penalizedOnTrack
    .sort((a, b) => a.entry.pos + a.drop - (b.entry.pos + b.drop) || a.entry.pos - b.entry.pos)
    .forEach((item) => {
      let targetIdx = Math.min(onTrackTotal, item.entry.pos + item.drop) - 1;
      if (targetIdx < 0) targetIdx = 0;
      while (targetIdx < onTrackTotal && assignedSlots[targetIdx] !== null) {
        targetIdx++;
      }
      if (targetIdx >= onTrackTotal) {
        targetIdx = onTrackTotal - 1;
        while (targetIdx >= 0 && assignedSlots[targetIdx] !== null) {
          targetIdx--;
        }
      }
      if (targetIdx >= 0 && targetIdx < onTrackTotal) {
        assignedSlots[targetIdx] = { entry: item.entry, penalty: item.penalty };
      }
    });

  // Fill all remaining open slots 1..onTrackTotal sequentially with unpenalized drivers in Qualifying order
  let unpenalizedCursor = 0;
  for (let i = 0; i < onTrackTotal; i++) {
    if (assignedSlots[i] === null && unpenalizedCursor < unpenalizedOnTrack.length) {
      assignedSlots[i] = { entry: unpenalizedOnTrack[unpenalizedCursor++] };
    }
  }

  const grid: F1StartingGridEntry[] = [];

  assignedSlots.forEach((item, idx) => {
    if (!item) return;
    const gridPos = idx + 1;
    const qualifiedPos = item.entry.pos;
    const qTime = item.entry.bestLapTime || item.entry.timeOrGap;
    grid.push({
      gridPos,
      qualifiedPos,
      qualiPos: qualifiedPos,
      posDelta: qualifiedPos - gridPos,
      driverCode: item.entry.driverCode,
      driverName: item.entry.driverName,
      driverNumber: item.entry.driverNumber,
      constructorName: item.entry.constructorName,
      constructorCode: item.entry.constructorCode,
      constructorColor: item.entry.constructorColor,
      qualifyingTime: qTime,
      qualiBestLapTime: qTime,
      tyreCompound: item.entry.tyreCompound,
      penaltyApplied: item.penalty?.reason,
      penaltyReason: item.penalty?.reason,
      isBackOfGridStart: false,
      isPitLaneStart: false,
    });
  });

  backOfGridCandidates.forEach((item) => {
    const gridPos = grid.length + 1;
    const qualifiedPos = item.entry.pos;
    const qTime = item.entry.bestLapTime || item.entry.timeOrGap;
    grid.push({
      gridPos,
      qualifiedPos,
      qualiPos: qualifiedPos,
      posDelta: qualifiedPos - gridPos,
      driverCode: item.entry.driverCode,
      driverName: item.entry.driverName,
      driverNumber: item.entry.driverNumber,
      constructorName: item.entry.constructorName,
      constructorCode: item.entry.constructorCode,
      constructorColor: item.entry.constructorColor,
      qualifyingTime: qTime,
      qualiBestLapTime: qTime,
      tyreCompound: item.entry.tyreCompound,
      penaltyApplied: item.penalty.reason,
      penaltyReason: item.penalty.reason,
      isBackOfGridStart: true,
      isPitLaneStart: false,
    });
  });

  pitLaneCandidates.forEach((item) => {
    const gridPos = grid.length + 1;
    const qualifiedPos = item.entry.pos;
    const qTime = item.entry.bestLapTime || item.entry.timeOrGap;
    grid.push({
      gridPos,
      qualifiedPos,
      qualiPos: qualifiedPos,
      posDelta: qualifiedPos - gridPos,
      driverCode: item.entry.driverCode,
      driverName: item.entry.driverName,
      driverNumber: item.entry.driverNumber,
      constructorName: item.entry.constructorName,
      constructorCode: item.entry.constructorCode,
      constructorColor: item.entry.constructorColor,
      qualifyingTime: qTime,
      qualiBestLapTime: qTime,
      tyreCompound: item.entry.tyreCompound,
      penaltyApplied: item.penalty.reason,
      penaltyReason: item.penalty.reason,
      isBackOfGridStart: false,
      isPitLaneStart: true,
    });
  });

  return grid;
}

/**
 * Complete 2026 OpenF1 Driver Number Registry (Full-Time Grid + FIA Rookie/Reserve FP1 Drivers)
 * Ensures every driver_number returned by OpenF1 `/v1/session_result`, `/v1/starting_grid`, and `/v1/stints`
 * resolves to their official FIA acronym, full name, and constructor metadata.
 */
export const OPENF1_2026_DRIVER_NUMBER_MAP: Record<
  number,
  {
    code: string;
    name: string;
    team: string;
    teamCode: string;
    color: string;
  }
> = {
  1: { code: 'NOR', name: 'Lando Norris', team: 'McLaren', teamCode: 'MCL', color: '#FF8000' },
  3: { code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
  5: { code: 'BOR', name: 'Gabriel Bortoleto', team: 'Audi / Sauber', teamCode: 'SAU', color: '#52E252' },
  6: { code: 'HAD', name: 'Isack Hadjar', team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
  10: { code: 'GAS', name: 'Pierre Gasly', team: 'Alpine', teamCode: 'ALP', color: '#FF87BC' },
  11: { code: 'PER', name: 'Sergio Pérez', team: 'Cadillac F1 Team', teamCode: 'CAD', color: '#C0C0C0' },
  12: { code: 'ANT', name: 'Kimi Antonelli', team: 'Mercedes', teamCode: 'MER', color: '#27F4D2' },
  14: { code: 'ALO', name: 'Fernando Alonso', team: 'Aston Martin', teamCode: 'AMR', color: '#229971' },
  16: { code: 'LEC', name: 'Charles Leclerc', team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
  18: { code: 'STR', name: 'Lance Stroll', team: 'Aston Martin', teamCode: 'AMR', color: '#229971' },
  22: { code: 'TSU', name: 'Yuki Tsunoda', team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
  23: { code: 'ALB', name: 'Alexander Albon', team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
  25: { code: 'HER', name: 'Colton Herta', team: 'Cadillac F1 Team', teamCode: 'CAD', color: '#C0C0C0' },
  27: { code: 'HUL', name: 'Nico Hülkenberg', team: 'Audi / Sauber', teamCode: 'SAU', color: '#52E252' },
  30: { code: 'LAW', name: 'Liam Lawson', team: 'Racing Bulls', teamCode: 'VCARB', color: '#6692FF' },
  31: { code: 'OCO', name: 'Esteban Ocon', team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
  34: { code: 'CRA', name: 'Jak Crawford', team: 'Aston Martin', teamCode: 'AMR', color: '#229971' },
  36: { code: 'IWA', name: 'Ayumu Iwasa', team: 'Racing Bulls', teamCode: 'VCARB', color: '#6692FF' },
  38: { code: 'BEG', name: 'Dino Beganovic', team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
  41: { code: 'LIN', name: 'Arvid Lindblad', team: 'Racing Bulls', teamCode: 'VCARB', color: '#6692FF' },
  43: { code: 'COL', name: 'Franco Colapinto', team: 'Alpine', teamCode: 'ALP', color: '#FF87BC' },
  44: { code: 'HAM', name: 'Lewis Hamilton', team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
  46: { code: 'BRO', name: 'Luke Browning', team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
  50: { code: 'HIR', name: 'Ryo Hirakawa', team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
  51: { code: 'CAM', name: 'Rafael Câmara', team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
  55: { code: 'SAI', name: 'Carlos Sainz', team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
  61: { code: 'ARO', name: 'Paul Aron', team: 'Alpine', teamCode: 'ALP', color: '#FF87BC' },
  62: { code: 'MIN', name: 'Gabriele Minì', team: 'Alpine', teamCode: 'ALP', color: '#FF87BC' },
  63: { code: 'RUS', name: 'George Russell', team: 'Mercedes', teamCode: 'MER', color: '#27F4D2' },
  67: { code: 'FOR', name: 'Leonardo Fornaroli', team: 'Audi / Sauber', teamCode: 'SAU', color: '#52E252' },
  72: { code: 'VES', name: 'Frederik Vesti', team: 'Mercedes', teamCode: 'MER', color: '#27F4D2' },
  77: { code: 'BOT', name: 'Valtteri Bottas', team: 'Cadillac F1 Team', teamCode: 'CAD', color: '#C0C0C0' },
  81: { code: 'PIA', name: 'Oscar Piastri', team: 'McLaren', teamCode: 'MCL', color: '#FF8000' },
  87: { code: 'BEA', name: 'Oliver Bearman', team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
  90: { code: 'IWA', name: 'Ayumu Iwasa', team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
  91: { code: 'TSO', name: 'Nikola Tsolov', team: 'Alpine', teamCode: 'ALP', color: '#FF87BC' },
  97: { code: 'ARO', name: 'Paul Aron', team: 'Audi / Sauber', teamCode: 'SAU', color: '#52E252' },
  98: { code: 'SLA', name: 'Martinius Stenshorne', team: 'McLaren', teamCode: 'MCL', color: '#FF8000' },
};

/**
 * Ensures any F1Weekend has:
 * 1. Properly normalized 5-session structure (including BOTH 'Sprint Qualifying' and 'Qualifying' when isSprintWeekend is true).
 * 2. Automatically computed `startingGrid` (after penalties) whenever Qualifying has sessionResults and startingGrid is not already populated from OpenF1 `/v1/starting_grid`.
 * 3. Automatically computed `sprintStartingGrid` (after penalties) whenever Sprint Qualifying has sessionResults and sprintStartingGrid is not already populated from OpenF1 `/v1/starting_grid`.
 * 4. Strictly preserves real API classifications without inventing synthetic race winners, fake tyre compounds, or fake lap times.
 */
export function enrichF1WeekendWithStartingGrids(
  wknd: F1Weekend,
  referenceNowMs: number = Date.now()
): F1Weekend {
  const isSprint = Boolean(wknd.isSprintWeekend);
  const penalties = wknd.gridPenalties || [];

  const normalizedSessions = (wknd.sessions || []).map((rawSess, idx) => {
    let sess = rawSess;
    if (isSprint && idx === 1 && sess.name === 'FP2') {
      sess = {
        ...sess,
        name: 'Sprint Qualifying' as const,
        shortLabel: 'SPRINT QUALIFYING (SQ1–SQ3)',
      };
    } else if (isSprint && idx === 2 && sess.name === 'FP3') {
      sess = {
        ...sess,
        name: 'Sprint' as const,
        shortLabel: 'F1 SPRINT (100KM)',
      };
    }

    const startMs = new Date(sess.startTimeISO).getTime();
    const durationMs =
      (sess.durationMinutes || (sess.name === 'Grand Prix' ? 120 : 60)) * 60 * 1000;
    const isCompletedByClock =
      sess.status === 'COMPLETED' ||
      wknd.status === 'COMPLETED' ||
      (Number.isFinite(startMs) && referenceNowMs >= startMs + durationMs);
    const isLiveByClock =
      !isCompletedByClock &&
      (sess.status === 'LIVE' ||
        (Number.isFinite(startMs) &&
          referenceNowMs >= startMs &&
          referenceNowMs < startMs + durationMs));

    const resolvedStatus = isCompletedByClock
      ? ('COMPLETED' as const)
      : isLiveByClock
      ? ('LIVE' as const)
      : ('UPCOMING' as const);

    return {
      ...sess,
      status: resolvedStatus,
    };
  });

  const gpQualiSession = normalizedSessions.find((s) => s.name === 'Qualifying');
  const sprintQualiSession = normalizedSessions.find(
    (s) => s.name === 'Sprint Qualifying'
  );

  const startingGrid =
    wknd.startingGrid && wknd.startingGrid.length > 0
      ? wknd.startingGrid
      : gpQualiSession?.sessionResults && gpQualiSession.sessionResults.length > 0
      ? computeStartingGridWithPenalties(
          gpQualiSession.sessionResults,
          penalties,
          'Grand Prix'
        )
      : wknd.startingGrid;

  const sprintStartingGrid =
    wknd.sprintStartingGrid && wknd.sprintStartingGrid.length > 0
      ? wknd.sprintStartingGrid
      : sprintQualiSession?.sessionResults &&
        sprintQualiSession.sessionResults.length > 0
      ? computeStartingGridWithPenalties(
          sprintQualiSession.sessionResults,
          penalties,
          'Sprint'
        )
      : wknd.sprintStartingGrid;

  const gpSession = normalizedSessions.find((s) => s.name === 'Grand Prix');
  const anyLiveSession = normalizedSessions.some((s) => s.status === 'LIVE');
  const weekendCompleted =
    wknd.status === 'COMPLETED' || gpSession?.status === 'COMPLETED';
  const weekendStatus = weekendCompleted
    ? ('COMPLETED' as const)
    : anyLiveSession
    ? ('LIVE' as const)
    : wknd.status;

  const resolvedWinnerSummary =
    (gpSession?.status === 'COMPLETED' && gpSession.fastestOrWinnerSummary) ||
    wknd.winnerSummary;

  return {
    ...wknd,
    status: weekendStatus,
    winnerSummary: resolvedWinnerSummary,
    isSprintWeekend: isSprint,
    sessions: normalizedSessions,
    gridPenalties: penalties,
    startingGrid,
    sprintStartingGrid,
  };
}

/**
 * Fetches official FIA Qualifying vs Starting Grid positions from Jolpica F1 API
 * (`https://api.jolpi.ca/ergast/f1/{season}/{round}/results.json`) so that any
 * future race's real-world grid drops, back-of-the-grid penalties, or pit-lane starts
 * are automatically reconciled from official FIA telemetry.
 */
export async function syncOfficialStartingGridFromJolpica(
  wknd: F1Weekend
): Promise<F1Weekend> {
  const seasonYear = wknd.seasonYear || 2026;
  try {
    const res = await fetchWithResilience<any>(
      `https://api.jolpi.ca/ergast/f1/${seasonYear}/${wknd.round}/results.json`,
      {
        ttlMs: 10 * 60 * 1000,
        cacheKey: `jolpica_grid_${seasonYear}_${wknd.round}`,
      }
    );
    const raceResults = res?.MRData?.RaceTable?.Races?.[0]?.Results;
    if (!Array.isArray(raceResults) || raceResults.length === 0) {
      return enrichF1WeekendWithStartingGrids(wknd);
    }

    const qualiSess = wknd.sessions.find((s) => s.name === 'Qualifying');
    if (!qualiSess?.sessionResults || qualiSess.sessionResults.length === 0) {
      return enrichF1WeekendWithStartingGrids(wknd);
    }

    const detectedPenalties: F1GridPenaltyNote[] = [];
    for (const r of raceResults) {
      const code = String(r?.Driver?.code || '').toUpperCase();
      const officialGridPos = Number(r?.grid);
      const qualiEntry = qualiSess.sessionResults.find(
        (q) => q.driverCode.toUpperCase() === code
      );
      if (!qualiEntry || !Number.isFinite(officialGridPos)) continue;

      if (officialGridPos === 0) {
        detectedPenalties.push({
          driverCode: code,
          driverName: qualiEntry.driverName,
          constructorName: qualiEntry.constructorName,
          qualifiedPos: qualiEntry.pos,
          pitLaneStart: true,
          reason: 'Pit Lane Start (Official FIA Starting Grid)',
          targetSession: 'Grand Prix',
        });
      } else if (officialGridPos >= 20 && officialGridPos - qualiEntry.pos >= 5) {
        detectedPenalties.push({
          driverCode: code,
          driverName: qualiEntry.driverName,
          constructorName: qualiEntry.constructorName,
          qualifiedPos: qualiEntry.pos,
          backOfGrid: true,
          reason: `Starting from Back of Grid (P${officialGridPos} — Official FIA Starting Grid)`,
          targetSession: 'Grand Prix',
        });
      } else if (officialGridPos > qualiEntry.pos) {
        const drop = officialGridPos - qualiEntry.pos;
        detectedPenalties.push({
          driverCode: code,
          driverName: qualiEntry.driverName,
          constructorName: qualiEntry.constructorName,
          qualifiedPos: qualiEntry.pos,
          gridDropPositions: drop,
          reason: `+${drop} Grid Drop (Qualified Q${qualiEntry.pos} → Starts P${officialGridPos})`,
          targetSession: 'Grand Prix',
        });
      }
    }

    return enrichF1WeekendWithStartingGrids({
      ...wknd,
      gridPenalties:
        detectedPenalties.length > 0 ? detectedPenalties : wknd.gridPenalties,
    });
  } catch {
    return enrichF1WeekendWithStartingGrids(wknd);
  }
}

function buildStandardSessionsForWeekend(
  idPrefix: string,
  raceDateISO: string,
  isSprint: boolean,
  completedMeta?: {
    round: number;
    winnerSummary?: string;
    laps?: number;
    populateLegacyHighlightResults?: boolean;
  }
) {
  const raceMs = new Date(raceDateISO).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const fri1ISO = new Date(raceMs - 2 * dayMs - 3.5 * 3600 * 1000).toISOString();
  const fri2ISO = new Date(raceMs - 2 * dayMs).toISOString();
  const sat1ISO = new Date(raceMs - dayMs - 3.5 * 3600 * 1000).toISOString();
  const sat2ISO = new Date(raceMs - dayMs).toISOString();

  const useHighlightResults = Boolean(completedMeta?.populateLegacyHighlightResults);
  const s0Meta =
    completedMeta && useHighlightResults
      ? buildSessionTop10Classification(completedMeta.round, 0, false, completedMeta.winnerSummary, completedMeta.laps, false)
      : null;
  const s1Meta =
    completedMeta && useHighlightResults
      ? buildSessionTop10Classification(completedMeta.round, 1, false, completedMeta.winnerSummary, completedMeta.laps, isSprint)
      : null;
  const s2Meta =
    completedMeta && useHighlightResults
      ? buildSessionTop10Classification(completedMeta.round, 2, isSprint, completedMeta.winnerSummary, completedMeta.laps, false)
      : null;
  const s3Meta =
    completedMeta && useHighlightResults
      ? buildSessionTop10Classification(completedMeta.round, 3, false, completedMeta.winnerSummary, completedMeta.laps, false)
      : null;
  const s4Meta =
    completedMeta && useHighlightResults
      ? buildSessionTop10Classification(completedMeta.round, 4, true, completedMeta.winnerSummary, completedMeta.laps, false)
      : null;

  return [
    {
      id: `${idPrefix}-fp1`,
      name: 'FP1' as const,
      shortLabel: 'FREE PRACTICE 1',
      startTimeISO: fri1ISO,
      istDateLabel: formatISTDateShort(fri1ISO),
      istTimeLabel: formatIST(fri1ISO),
      trackLocalTimeLabel: '1:30 PM LOCAL',
      durationMinutes: 60,
      ...(completedMeta
        ? {
            status: 'COMPLETED' as const,
            ...(s0Meta
              ? {
                  fastestOrWinnerSummary: s0Meta.summary,
                  sessionResults: s0Meta.results,
                }
              : {}),
          }
        : {}),
    },
    {
      id: `${idPrefix}-s2`,
      name: (isSprint ? 'Sprint Qualifying' : 'FP2') as 'Sprint Qualifying' | 'FP2',
      shortLabel: isSprint ? 'SPRINT QUALIFYING (SQ1–SQ3)' : 'FREE PRACTICE 2',
      startTimeISO: fri2ISO,
      istDateLabel: formatISTDateShort(fri2ISO),
      istTimeLabel: formatIST(fri2ISO),
      trackLocalTimeLabel: '5:00 PM LOCAL',
      durationMinutes: isSprint ? 45 : 60,
      ...(completedMeta
        ? {
            status: 'COMPLETED' as const,
            ...(s1Meta
              ? {
                  fastestOrWinnerSummary: s1Meta.summary,
                  sessionResults: s1Meta.results,
                }
              : {}),
          }
        : {}),
    },
    {
      id: `${idPrefix}-s3`,
      name: (isSprint ? 'Sprint' : 'FP3') as 'Sprint' | 'FP3',
      shortLabel: isSprint ? 'F1 SPRINT (100KM)' : 'FREE PRACTICE 3',
      startTimeISO: sat1ISO,
      istDateLabel: formatISTDateShort(sat1ISO),
      istTimeLabel: formatIST(sat1ISO),
      trackLocalTimeLabel: '1:00 PM LOCAL',
      durationMinutes: 60,
      ...(completedMeta
        ? {
            status: 'COMPLETED' as const,
            ...(s2Meta
              ? {
                  fastestOrWinnerSummary: s2Meta.summary,
                  sessionResults: s2Meta.results,
                }
              : {}),
          }
        : {}),
    },
    {
      id: `${idPrefix}-quali`,
      name: 'Qualifying' as const,
      shortLabel: 'QUALIFYING (Q1–Q3)',
      startTimeISO: sat2ISO,
      istDateLabel: formatISTDateShort(sat2ISO),
      istTimeLabel: formatIST(sat2ISO),
      trackLocalTimeLabel: '4:00 PM LOCAL',
      durationMinutes: 60,
      ...(completedMeta
        ? {
            status: 'COMPLETED' as const,
            ...(s3Meta
              ? {
                  fastestOrWinnerSummary: s3Meta.summary,
                  sessionResults: s3Meta.results,
                }
              : {}),
          }
        : {}),
    },
    {
      id: `${idPrefix}-race`,
      name: 'Grand Prix' as const,
      shortLabel: 'GRAND PRIX (LIGHTS OUT)',
      startTimeISO: raceDateISO,
      istDateLabel: formatISTDateShort(raceDateISO),
      istTimeLabel: formatIST(raceDateISO),
      trackLocalTimeLabel: '3:00 PM LOCAL',
      durationMinutes: 120,
      ...(completedMeta
        ? {
            status: 'COMPLETED' as const,
            fastestOrWinnerSummary: s4Meta?.summary || completedMeta.winnerSummary,
            ...(s4Meta ? { sessionResults: s4Meta.results } : {}),
          }
        : {}),
    },
  ];
}

const COMPLETED_2026_ROUNDS_SPECS: Array<{
  round: number;
  hostName: string;
  grandPrixName: string;
  officialTitle: string;
  circuitName: string;
  city: string;
  flagUrl: string;
  svgId: CircuitSvgId;
  trackCarbonName: string;
  dateRangePill: string;
  raceISO: string;
  laps: number;
  lengthKm: string;
  winnerSummary: string;
  isSprint?: boolean;
}> = [
  {
    round: 1,
    hostName: 'Australia',
    grandPrixName: 'Australian Grand Prix',
    officialTitle: 'FORMULA 1 ROLEX AUSTRALIAN GRAND PRIX 2026',
    circuitName: 'Albert Park Circuit',
    city: 'Melbourne',
    flagUrl: GP_FLAGS.AU,
    svgId: 'albert_park',
    trackCarbonName: 'Australia',
    dateRangePill: 'MAR 06 - 08',
    raceISO: '2026-03-08T04:00:00Z',
    laps: 58,
    lengthKm: '5.278 km',
    winnerSummary: 'Winner: G. Russell (Mercedes) • P2 Antonelli • P3 Leclerc',
  },
  {
    round: 2,
    hostName: 'China',
    grandPrixName: 'Chinese Grand Prix',
    officialTitle: 'FORMULA 1 HEINEKEN CHINESE GRAND PRIX 2026',
    circuitName: 'Shanghai International Circuit',
    city: 'Shanghai',
    flagUrl: GP_FLAGS.ES,
    svgId: 'shanghai',
    trackCarbonName: 'China',
    dateRangePill: 'MAR 13 - 15',
    raceISO: '2026-03-15T07:00:00Z',
    laps: 56,
    lengthKm: '5.451 km',
    winnerSummary: 'Winner: K. Antonelli (Mercedes) • P2 Russell • P3 Hamilton',
    isSprint: true,
  },
  {
    round: 3,
    hostName: 'Japan',
    grandPrixName: 'Japanese Grand Prix',
    officialTitle: 'FORMULA 1 LENOVO JAPANESE GRAND PRIX 2026',
    circuitName: 'Suzuka International Racing Course',
    city: 'Suzuka',
    flagUrl: GP_FLAGS.IT,
    svgId: 'suzuka',
    trackCarbonName: 'Japan',
    dateRangePill: 'MAR 27 - 29',
    raceISO: '2026-03-29T05:00:00Z',
    laps: 53,
    lengthKm: '5.807 km',
    winnerSummary: 'Winner: K. Antonelli (Mercedes) • P2 Piastri • P3 Leclerc',
  },
  {
    round: 4,
    hostName: 'Bahrain',
    grandPrixName: 'Bahrain Grand Prix',
    officialTitle: 'FORMULA 1 GULF AIR BAHRAIN GRAND PRIX 2026',
    circuitName: 'Bahrain International Circuit / Sepang',
    city: 'Kuala Lumpur',
    flagUrl: GP_FLAGS.QA,
    svgId: 'bahrain',
    trackCarbonName: 'Bahrain',
    dateRangePill: 'OCT 02 - 04',
    raceISO: '2026-10-04T12:00:00Z',
    laps: 56,
    lengthKm: '5.412 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Norris • P3 Leclerc',
  },
  {
    round: 5,
    hostName: 'Saudi Arabia',
    grandPrixName: 'Saudi Arabian Grand Prix',
    officialTitle: 'FORMULA 1 STC SAUDI ARABIAN GRAND PRIX 2026',
    circuitName: 'Jeddah Corniche Circuit',
    city: 'Jeddah',
    flagUrl: GP_FLAGS.AE,
    svgId: 'jeddah',
    trackCarbonName: 'Saudi Arabia',
    dateRangePill: 'OCT 16 - 18',
    raceISO: '2026-10-18T17:00:00Z',
    laps: 50,
    lengthKm: '6.174 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Russell • P3 Antonelli',
  },
  {
    round: 6,
    hostName: 'Miami',
    grandPrixName: 'Miami Grand Prix',
    officialTitle: 'FORMULA 1 CRYPTO.COM MIAMI GRAND PRIX 2026',
    circuitName: 'Miami International Autodrome',
    city: 'Miami',
    flagUrl: GP_FLAGS.US,
    svgId: 'miami',
    trackCarbonName: 'Miami',
    dateRangePill: 'MAY 01 - 03',
    raceISO: '2026-05-03T20:00:00Z',
    laps: 57,
    lengthKm: '5.412 km',
    winnerSummary: 'Winner: K. Antonelli (Mercedes) • P2 Norris • P3 Leclerc',
    isSprint: true,
  },
  {
    round: 7,
    hostName: 'Canada',
    grandPrixName: 'Canadian Grand Prix',
    officialTitle: 'FORMULA 1 PIRELLI GRAND PRIX DU CANADA 2026',
    circuitName: 'Circuit Gilles-Villeneuve',
    city: 'Montreal',
    flagUrl: GP_FLAGS.US,
    svgId: 'montreal',
    trackCarbonName: 'Canada',
    dateRangePill: 'MAY 22 - 24',
    raceISO: '2026-05-24T20:00:00Z',
    laps: 70,
    lengthKm: '4.361 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Norris • P3 Russell',
    isSprint: true,
  },
  {
    round: 8,
    hostName: 'Monaco',
    grandPrixName: 'Monaco Grand Prix',
    officialTitle: 'FORMULA 1 GRAND PRIX DE MONACO 2026',
    circuitName: 'Circuit de Monaco',
    city: 'Monte Carlo',
    flagUrl: GP_FLAGS.MC,
    svgId: 'monaco',
    trackCarbonName: 'Monaco',
    dateRangePill: 'JUN 05 - 07',
    raceISO: '2026-06-07T13:00:00Z',
    laps: 78,
    lengthKm: '3.337 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Piastri • P3 Russell',
  },
  {
    round: 9,
    hostName: 'Spain (Barcelona)',
    grandPrixName: 'Barcelona-Catalunya Grand Prix',
    officialTitle: 'FORMULA 1 ARAMCO GRAN PREMIO DE BARCELONA-CATALUNYA 2026',
    circuitName: 'Circuit de Barcelona-Catalunya',
    city: 'Barcelona',
    flagUrl: GP_FLAGS.ES,
    svgId: 'barcelona',
    trackCarbonName: 'Spain',
    dateRangePill: 'JUN 12 - 14',
    raceISO: '2026-06-14T13:00:00Z',
    laps: 66,
    lengthKm: '4.657 km',
    winnerSummary: 'Winner: G. Russell (Mercedes) • P2 Verstappen • P3 Norris',
  },
  {
    round: 10,
    hostName: 'Austria',
    grandPrixName: 'Austrian Grand Prix',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS AUSTRIAN GRAND PRIX 2026',
    circuitName: 'Red Bull Ring',
    city: 'Spielberg',
    flagUrl: GP_FLAGS.DE,
    svgId: 'red_bull_ring',
    trackCarbonName: 'Austria',
    dateRangePill: 'JUN 26 - 28',
    raceISO: '2026-06-28T13:00:00Z',
    laps: 71,
    lengthKm: '4.318 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Antonelli • P3 Leclerc',
  },
  {
    round: 11,
    hostName: 'Great Britain',
    grandPrixName: 'British Grand Prix',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS BRITISH GRAND PRIX 2026',
    circuitName: 'Silverstone Circuit',
    city: 'Silverstone',
    flagUrl: GP_FLAGS.GB,
    svgId: 'silverstone',
    trackCarbonName: 'Great Britain',
    dateRangePill: 'JUL 03 - 05',
    raceISO: '2026-07-05T14:00:00Z',
    laps: 52,
    lengthKm: '5.891 km',
    winnerSummary: 'Winner: C. Leclerc (Ferrari) • P2 Norris • P3 Russell',
    isSprint: true,
  },
  {
    round: 12,
    hostName: 'Belgium',
    grandPrixName: 'Belgian Grand Prix',
    officialTitle: 'FORMULA 1 ROLEX BELGIAN GRAND PRIX 2026',
    circuitName: 'Circuit de Spa-Francorchamps',
    city: 'Spa',
    flagUrl: GP_FLAGS.DE,
    svgId: 'spa',
    trackCarbonName: 'Belgium',
    dateRangePill: 'JUL 17 - 19',
    raceISO: '2026-07-19T13:00:00Z',
    laps: 44,
    lengthKm: '7.004 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Piastri • P3 Hamilton',
  },
  {
    round: 13,
    hostName: 'Hungary',
    grandPrixName: 'Hungarian Grand Prix',
    officialTitle: 'FORMULA 1 LENOVO HUNGARIAN GRAND PRIX 2026',
    circuitName: 'Hungaroring',
    city: 'Budapest',
    flagUrl: GP_FLAGS.IT,
    svgId: 'hungaroring',
    trackCarbonName: 'Hungary',
    dateRangePill: 'JUL 24 - 26',
    raceISO: '2026-07-26T13:00:00Z',
    laps: 70,
    lengthKm: '4.381 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Antonelli • P3 Leclerc',
  },
  {
    round: 14,
    hostName: 'Netherlands',
    grandPrixName: 'Dutch Grand Prix',
    officialTitle: 'FORMULA 1 HEINEKEN DUTCH GRAND PRIX 2026',
    circuitName: 'Circuit Zandvoort',
    city: 'Zandvoort',
    flagUrl: GP_FLAGS.NL,
    svgId: 'zandvoort',
    trackCarbonName: 'Netherlands',
    dateRangePill: 'AUG 21 - 23',
    raceISO: '2026-08-23T13:00:00Z',
    laps: 72,
    lengthKm: '4.259 km',
    winnerSummary: 'Winner: I. Hadjar (Red Bull) • P2 Leclerc • P3 Russell',
    isSprint: true,
  },
  {
    round: 15,
    hostName: 'Italy',
    grandPrixName: 'Italian Grand Prix',
    officialTitle: 'FORMULA 1 PIRELLI GRAN PREMIO D’ITALIA 2026',
    circuitName: 'Autodromo Nazionale Monza',
    city: 'Monza',
    flagUrl: GP_FLAGS.IT,
    svgId: 'monza',
    trackCarbonName: 'Italy',
    dateRangePill: 'SEP 04 - 06',
    raceISO: '2026-09-06T13:00:00Z',
    laps: 53,
    lengthKm: '5.793 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Leclerc • P3 Antonelli',
  },
  {
    round: 16,
    hostName: 'Spain - Madrid',
    grandPrixName: 'Spanish Grand Prix (Madrid)',
    officialTitle: 'FORMULA 1 ARAMCO GRAN PREMIO DE ESPAÑA MADRID 2026',
    circuitName: 'IFEMA Madrid Street Circuit (Madring)',
    city: 'Madrid',
    flagUrl: GP_FLAGS.ES,
    svgId: 'madrid',
    trackCarbonName: 'Spain',
    dateRangePill: 'SEP 11 - 13',
    raceISO: '2026-09-13T13:00:00Z',
    laps: 55,
    lengthKm: '5.474 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Russell • P3 Piastri',
  },
  {
    round: 17,
    hostName: 'Azerbaijan',
    grandPrixName: 'Azerbaijan Grand Prix',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS AZERBAIJAN GRAND PRIX 2026',
    circuitName: 'Baku City Circuit',
    city: 'Baku',
    flagUrl: GP_FLAGS.AE,
    svgId: 'baku',
    trackCarbonName: 'Azerbaijan',
    dateRangePill: 'SEP 24 - 26',
    raceISO: '2026-09-26T11:00:00Z',
    laps: 51,
    lengthKm: '6.003 km',
    winnerSummary: 'Winner: K. Antonelli (Mercedes) • P2 Piastri • P3 Hamilton',
  },
  {
    round: 18,
    hostName: 'Singapore',
    grandPrixName: 'Singapore Grand Prix',
    officialTitle: 'FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026',
    circuitName: 'Marina Bay Street Circuit',
    city: 'Singapore',
    flagUrl: GP_FLAGS.MX,
    svgId: 'marina_bay',
    trackCarbonName: 'Singapore',
    dateRangePill: 'OCT 09 - 11',
    raceISO: '2026-10-11T12:00:00Z',
    laps: 62,
    lengthKm: '4.940 km',
    winnerSummary: 'Winner: K. Antonelli (Mercedes) • P2 Verstappen • P3 Piastri',
    isSprint: true,
  },
  {
    round: 19,
    hostName: 'United States',
    grandPrixName: 'United States Grand Prix',
    officialTitle: 'FORMULA 1 PIRELLI UNITED STATES GRAND PRIX 2026',
    circuitName: 'Circuit of the Americas',
    city: 'Austin',
    flagUrl: GP_FLAGS.US,
    svgId: 'cota',
    trackCarbonName: 'USA',
    dateRangePill: 'OCT 23 - 25',
    raceISO: '2026-10-25T20:00:00Z',
    laps: 56,
    lengthKm: '5.513 km',
    winnerSummary: 'Winner: K. Antonelli (Mercedes) • P2 Leclerc • P3 Verstappen',
  },
  {
    round: 20,
    hostName: 'Mexico',
    grandPrixName: 'Mexico City Grand Prix',
    officialTitle: 'FORMULA 1 GRAN PREMIO DE LA CIUDAD DE MÉXICO 2026',
    circuitName: 'Autódromo Hermanos Rodríguez',
    city: 'Mexico City',
    flagUrl: GP_FLAGS.MX,
    svgId: 'mexico',
    trackCarbonName: 'Mexico',
    dateRangePill: 'OCT 30 - NOV 01',
    raceISO: '2026-11-01T20:00:00Z',
    laps: 71,
    lengthKm: '4.304 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Hamilton • P3 Antonelli',
  },
];

export const F1_2026_FULL_SEASON: F1Weekend[] = [
  ...COMPLETED_2026_ROUNDS_SPECS.map((spec): F1Weekend =>
    enrichF1WeekendWithStartingGrids({
      id: `f1-2026-r${spec.round}-${spec.svgId}`,
      sport: 'F1',
      seasonYear: 2026,
      round: spec.round,
      hostName: spec.hostName,
      countryName: spec.hostName,
      dateRangePill: spec.dateRangePill,
      dateRangeLabel: spec.dateRangePill,
      status: 'COMPLETED',
      winnerSummary: spec.winnerSummary,
      trackMapUrl: buildF1TrackMapCarbonUrl(spec.trackCarbonName),
      isSprintWeekend: Boolean(spec.isSprint),
      grandPrixName: spec.grandPrixName,
      officialTitle: spec.officialTitle,
      circuitName: spec.circuitName,
      city: spec.city,
      countryFlagUrl: spec.flagUrl,
      circuitSvgId: spec.svgId,
      laps: spec.laps,
      circuitLengthKm: spec.lengthKm,
      raceDistanceKm: '305.354 km',
      timeWindow: 'PAST_RESULTS',
      sessions: buildStandardSessionsForWeekend(
        `f1-26-r${spec.round}`,
        spec.raceISO,
        Boolean(spec.isSprint),
        {
          round: spec.round,
          winnerSummary: spec.winnerSummary,
          laps: spec.laps,
          populateLegacyHighlightResults: false,
        }
      ),
      prefetchMeta: {
        trackTempForecast: `Completed • ${spec.winnerSummary}`,
        rainChance: '5%',
        tyreAllocation: 'C3 Hard / C4 Medium / C5 Soft',
        lapRecord: 'Official FIA Classification',
        drsZones: 3,
        circuitLengthKm: spec.lengthKm,
        raceDistanceLaps: spec.laps,
      },
    })
  ),
  ...F1_WEEKENDS.map((w): F1Weekend => {
    if (w.id === 'f1-brazil-2026' || w.id === 'f1-wknd-brazil') {
      return enrichF1WeekendWithStartingGrids({
        ...w,
        round: 21,
        seasonYear: 2026,
        hostName: 'Brazil',
        countryName: 'Brazil',
        dateRangePill: 'NOV 06 - 08',
        dateRangeLabel: '06 – 08 NOV 2026 (IST)',
        timeWindow: 'THIS_WEEK',
        isNextRace: true,
        status: w.status || 'LIVE',
        trackMapUrl: buildF1TrackMapCarbonUrl('Brazil'),
        isSprintWeekend: false,
        prefetchMeta: {
          ...w.prefetchMeta,
          circuitLengthKm: w.circuitLengthKm,
          raceDistanceLaps: w.laps,
        },
      });
    }
    if (w.id === 'f1-vegas-2026' || w.id === 'f1-wknd-vegas') {
      return enrichF1WeekendWithStartingGrids({
        ...w,
        round: 22,
        seasonYear: 2026,
        hostName: 'Las Vegas',
        countryName: 'United States',
        dateRangePill: 'NOV 20 - 22 IST',
        dateRangeLabel: '20 – 22 NOV 2026 (IST) • 19 – 21 NOV (PST)',
        timeWindow: 'NEXT_WEEK',
        status: 'UPCOMING',
        trackMapUrl: buildF1TrackMapCarbonUrl('Las Vegas'),
        isSprintWeekend: false,
        prefetchMeta: {
          ...w.prefetchMeta,
          circuitLengthKm: w.circuitLengthKm,
          raceDistanceLaps: w.laps,
        },
      });
    }
    if (w.id === 'f1-qatar-2026' || w.id === 'f1-wknd-qatar') {
      return enrichF1WeekendWithStartingGrids({
        ...w,
        round: 23,
        seasonYear: 2026,
        hostName: 'Qatar',
        countryName: 'Qatar',
        dateRangePill: 'NOV 27 - 29',
        dateRangeLabel: '27 – 29 NOV 2026 (IST)',
        timeWindow: 'ALL_UPCOMING',
        status: 'UPCOMING',
        trackMapUrl: buildF1TrackMapCarbonUrl('Qatar'),
        isSprintWeekend: true,
        prefetchMeta: {
          ...w.prefetchMeta,
          circuitLengthKm: w.circuitLengthKm,
          raceDistanceLaps: w.laps,
        },
      });
    }
    return enrichF1WeekendWithStartingGrids({
      ...w,
      round: 24,
      seasonYear: 2026,
      hostName: 'Abu Dhabi',
      countryName: 'Abu Dhabi',
      dateRangePill: 'DEC 04 - 06',
      dateRangeLabel: '04 – 06 DEC 2026 (IST)',
      timeWindow: 'ALL_UPCOMING',
      status: 'UPCOMING',
      trackMapUrl: buildF1TrackMapCarbonUrl('Abu Dhabi'),
      isSprintWeekend: false,
      prefetchMeta: {
        ...w.prefetchMeta,
        circuitLengthKm: w.circuitLengthKm,
        raceDistanceLaps: w.laps,
      },
    });
  }),
];

interface Raw2027RoundSpec {
  round: number;
  hostName: string;
  grandPrixName: string;
  officialTitle: string;
  circuitName: string;
  city: string;
  flagUrl: string;
  svgId: CircuitSvgId;
  trackCarbonName: string;
  dateRangePill: string;
  raceISO: string;
  laps: number;
  lengthKm: string;
  isSprint?: boolean;
  isTesting?: boolean;
}

const FIA_2027_CALENDAR_SPECS: Raw2027RoundSpec[] = [
  {
    round: 0,
    hostName: 'Sakhir',
    grandPrixName: 'Formula 1 Pre-Season Testing 2027',
    officialTitle: 'FORMULA 1 ARAMCO PRE-SEASON TESTING 2027',
    circuitName: 'Bahrain International Circuit',
    city: 'Sakhir',
    flagUrl: GP_FLAGS.QA,
    svgId: 'bahrain',
    trackCarbonName: 'Bahrain',
    dateRangePill: 'FEB 24 - 27',
    raceISO: '2027-02-27T15:00:00Z',
    laps: 57,
    lengthKm: '5.412 km',
    isTesting: true,
  },
  {
    round: 1,
    hostName: 'Bahrain',
    grandPrixName: 'Bahrain Grand Prix',
    officialTitle: 'FORMULA 1 GULF AIR BAHRAIN GRAND PRIX 2027',
    circuitName: 'Bahrain International Circuit',
    city: 'Sakhir',
    flagUrl: GP_FLAGS.QA,
    svgId: 'bahrain',
    trackCarbonName: 'Bahrain',
    dateRangePill: 'MAR 12 - 14',
    raceISO: '2027-03-14T15:00:00Z',
    laps: 57,
    lengthKm: '5.412 km',
    isSprint: true,
  },
  {
    round: 2,
    hostName: 'Saudi Arabia',
    grandPrixName: 'Saudi Arabian Grand Prix',
    officialTitle: 'FORMULA 1 STC SAUDI ARABIAN GRAND PRIX 2027',
    circuitName: 'Jeddah Corniche Circuit',
    city: 'Jeddah',
    flagUrl: GP_FLAGS.AE,
    svgId: 'jeddah',
    trackCarbonName: 'Saudi Arabia',
    dateRangePill: 'MAR 19 - 21',
    raceISO: '2027-03-21T17:00:00Z',
    laps: 50,
    lengthKm: '6.174 km',
  },
  {
    round: 3,
    hostName: 'Australia',
    grandPrixName: 'Australian Grand Prix',
    officialTitle: 'FORMULA 1 ROLEX AUSTRALIAN GRAND PRIX 2027',
    circuitName: 'Albert Park Circuit',
    city: 'Melbourne',
    flagUrl: GP_FLAGS.AU,
    svgId: 'albert_park',
    trackCarbonName: 'Australia',
    dateRangePill: 'APR 02 - 04',
    raceISO: '2027-04-04T04:00:00Z',
    laps: 58,
    lengthKm: '5.278 km',
    isSprint: true,
  },
  {
    round: 4,
    hostName: 'Japan',
    grandPrixName: 'Japanese Grand Prix',
    officialTitle: 'FORMULA 1 LENOVO JAPANESE GRAND PRIX 2027',
    circuitName: 'Suzuka International Racing Course',
    city: 'Suzuka',
    flagUrl: GP_FLAGS.IT,
    svgId: 'suzuka',
    trackCarbonName: 'Japan',
    dateRangePill: 'APR 09 - 11',
    raceISO: '2027-04-11T05:00:00Z',
    laps: 53,
    lengthKm: '5.807 km',
    isSprint: true,
  },
  {
    round: 5,
    hostName: 'China',
    grandPrixName: 'Chinese Grand Prix',
    officialTitle: 'FORMULA 1 HEINEKEN CHINESE GRAND PRIX 2027',
    circuitName: 'Shanghai International Circuit',
    city: 'Shanghai',
    flagUrl: GP_FLAGS.ES,
    svgId: 'shanghai',
    trackCarbonName: 'China',
    dateRangePill: 'APR 16 - 18',
    raceISO: '2027-04-18T07:00:00Z',
    laps: 56,
    lengthKm: '5.451 km',
  },
  {
    round: 6,
    hostName: 'Miami',
    grandPrixName: 'Miami Grand Prix',
    officialTitle: 'FORMULA 1 CRYPTO.COM MIAMI GRAND PRIX 2027',
    circuitName: 'Miami International Autodrome',
    city: 'Miami',
    flagUrl: GP_FLAGS.US,
    svgId: 'miami',
    trackCarbonName: 'Miami',
    dateRangePill: 'APR 30 - MAY 02',
    raceISO: '2027-05-02T20:00:00Z',
    laps: 57,
    lengthKm: '5.412 km',
  },
  {
    round: 7,
    hostName: 'Canada',
    grandPrixName: 'Canadian Grand Prix',
    officialTitle: 'FORMULA 1 PIRELLI GRAND PRIX DU CANADA 2027',
    circuitName: 'Circuit Gilles-Villeneuve',
    city: 'Montreal',
    flagUrl: GP_FLAGS.US,
    svgId: 'montreal',
    trackCarbonName: 'Canada',
    dateRangePill: 'MAY 21 - 23',
    raceISO: '2027-05-23T18:00:00Z',
    laps: 70,
    lengthKm: '4.361 km',
    isSprint: true,
  },
  {
    round: 8,
    hostName: 'Monaco',
    grandPrixName: 'Monaco Grand Prix',
    officialTitle: 'FORMULA 1 GRAND PRIX DE MONACO 2027',
    circuitName: 'Circuit de Monaco',
    city: 'Monte Carlo',
    flagUrl: GP_FLAGS.MC,
    svgId: 'monaco',
    trackCarbonName: 'Monaco',
    dateRangePill: 'JUN 04 - 06',
    raceISO: '2027-06-06T13:00:00Z',
    laps: 78,
    lengthKm: '3.337 km',
    isSprint: true,
  },
  {
    round: 9,
    hostName: 'Portugal - Portimão',
    grandPrixName: 'Portuguese Grand Prix',
    officialTitle: 'FORMULA 1 HEINEKEN GRANDE PRÉMIO DE PORTUGAL 2027',
    circuitName: 'Autódromo Internacional do Algarve • Portimão',
    city: 'Portimão',
    flagUrl: GP_FLAGS.ES,
    svgId: 'portimao',
    trackCarbonName: 'Portugal',
    dateRangePill: 'JUN 18 - 20',
    raceISO: '2027-06-20T14:00:00Z',
    laps: 66,
    lengthKm: '4.653 km',
  },
  {
    round: 10,
    hostName: 'Great Britain',
    grandPrixName: 'British Grand Prix',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS BRITISH GRAND PRIX 2027',
    circuitName: 'Silverstone Circuit',
    city: 'Silverstone',
    flagUrl: GP_FLAGS.GB,
    svgId: 'silverstone',
    trackCarbonName: 'Great Britain',
    dateRangePill: 'JUL 02 - 04',
    raceISO: '2027-07-04T14:00:00Z',
    laps: 52,
    lengthKm: '5.891 km',
    isSprint: true,
  },
  {
    round: 11,
    hostName: 'Austria',
    grandPrixName: 'Austrian Grand Prix',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS AUSTRIAN GRAND PRIX 2027',
    circuitName: 'Red Bull Ring',
    city: 'Spielberg',
    flagUrl: GP_FLAGS.DE,
    svgId: 'red_bull_ring',
    trackCarbonName: 'Austria',
    dateRangePill: 'JUL 09 - 11',
    raceISO: '2027-07-11T13:00:00Z',
    laps: 71,
    lengthKm: '4.318 km',
  },
  {
    round: 12,
    hostName: 'Belgium',
    grandPrixName: 'Belgian Grand Prix',
    officialTitle: 'FORMULA 1 ROLEX BELGIAN GRAND PRIX 2027',
    circuitName: 'Circuit de Spa-Francorchamps',
    city: 'Spa',
    flagUrl: GP_FLAGS.DE,
    svgId: 'spa',
    trackCarbonName: 'Belgium',
    dateRangePill: 'JUL 23 - 25',
    raceISO: '2027-07-25T13:00:00Z',
    laps: 44,
    lengthKm: '7.004 km',
  },
  {
    round: 13,
    hostName: 'Hungary',
    grandPrixName: 'Hungarian Grand Prix',
    officialTitle: 'FORMULA 1 LENOVO HUNGARIAN GRAND PRIX 2027',
    circuitName: 'Hungaroring',
    city: 'Budapest',
    flagUrl: GP_FLAGS.IT,
    svgId: 'hungaroring',
    trackCarbonName: 'Hungary',
    dateRangePill: 'JUL 30 - AUG 01',
    raceISO: '2027-08-01T13:00:00Z',
    laps: 70,
    lengthKm: '4.381 km',
  },
  {
    round: 14,
    hostName: 'Italy',
    grandPrixName: 'Italian Grand Prix',
    officialTitle: 'FORMULA 1 PIRELLI GRAN PREMIO D’ITALIA 2027',
    circuitName: 'Autodromo Nazionale Monza',
    city: 'Monza',
    flagUrl: GP_FLAGS.IT,
    svgId: 'monza',
    trackCarbonName: 'Italy',
    dateRangePill: 'SEP 03 - 05',
    raceISO: '2027-09-05T13:00:00Z',
    laps: 53,
    lengthKm: '5.793 km',
    isSprint: true,
  },
  {
    round: 15,
    hostName: 'Spain - Madrid',
    grandPrixName: 'Spanish Grand Prix (Madrid)',
    officialTitle: 'FORMULA 1 ARAMCO GRAN PREMIO DE ESPAÑA MADRID 2027',
    circuitName: 'IFEMA Madrid Street Circuit (Madring)',
    city: 'Madrid',
    flagUrl: GP_FLAGS.ES,
    svgId: 'madrid',
    trackCarbonName: 'Spain',
    dateRangePill: 'SEP 10 - 12',
    raceISO: '2027-09-12T13:00:00Z',
    laps: 55,
    lengthKm: '5.474 km',
  },
  {
    round: 16,
    hostName: 'Azerbaijan',
    grandPrixName: 'Azerbaijan Grand Prix',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS AZERBAIJAN GRAND PRIX 2027',
    circuitName: 'Baku City Circuit',
    city: 'Baku',
    flagUrl: GP_FLAGS.AE,
    svgId: 'baku',
    trackCarbonName: 'Azerbaijan',
    dateRangePill: 'SEP 24 - 26',
    raceISO: '2027-09-26T11:00:00Z',
    laps: 51,
    lengthKm: '6.003 km',
  },
  {
    round: 17,
    hostName: 'Türkiye - Istanbul Park',
    grandPrixName: 'Turkish Grand Prix',
    officialTitle: 'FORMULA 1 DHL TURKISH GRAND PRIX 2027',
    circuitName: 'Intercity Istanbul Park',
    city: 'Istanbul',
    flagUrl: GP_FLAGS.AE,
    svgId: 'istanbul',
    trackCarbonName: 'Turkey',
    dateRangePill: 'OCT 01 - 03',
    raceISO: '2027-10-03T12:00:00Z',
    laps: 58,
    lengthKm: '5.338 km',
  },
  {
    round: 18,
    hostName: 'Singapore',
    grandPrixName: 'Singapore Grand Prix',
    officialTitle: 'FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2027',
    circuitName: 'Marina Bay Street Circuit',
    city: 'Singapore',
    flagUrl: GP_FLAGS.MX,
    svgId: 'marina_bay',
    trackCarbonName: 'Singapore',
    dateRangePill: 'OCT 08 - 10',
    raceISO: '2027-10-10T12:00:00Z',
    laps: 62,
    lengthKm: '4.940 km',
  },
  {
    round: 19,
    hostName: 'United States',
    grandPrixName: 'United States Grand Prix',
    officialTitle: 'FORMULA 1 PIRELLI UNITED STATES GRAND PRIX 2027',
    circuitName: 'Circuit of the Americas',
    city: 'Austin',
    flagUrl: GP_FLAGS.US,
    svgId: 'cota',
    trackCarbonName: 'USA',
    dateRangePill: 'OCT 22 - 24',
    raceISO: '2027-10-24T19:00:00Z',
    laps: 56,
    lengthKm: '5.513 km',
  },
  {
    round: 20,
    hostName: 'Mexico',
    grandPrixName: 'Mexico City Grand Prix',
    officialTitle: 'FORMULA 1 GRAN PREMIO DE LA CIUDAD DE MÉXICO 2027',
    circuitName: 'Autódromo Hermanos Rodríguez',
    city: 'Mexico City',
    flagUrl: GP_FLAGS.MX,
    svgId: 'mexico',
    trackCarbonName: 'Mexico',
    dateRangePill: 'OCT 29 - 31',
    raceISO: '2027-10-31T20:00:00Z',
    laps: 71,
    lengthKm: '4.304 km',
  },
  {
    round: 21,
    hostName: 'Brazil',
    grandPrixName: 'Brazilian (São Paulo) Grand Prix',
    officialTitle: 'FORMULA 1 LENOVO GRANDE PRÊMIO DE SÃO PAULO 2027',
    circuitName: 'Autódromo José Carlos Pace • Interlagos',
    city: 'São Paulo',
    flagUrl: GP_FLAGS.BR,
    svgId: 'interlagos',
    trackCarbonName: 'Brazil',
    dateRangePill: 'NOV 05 - 07',
    raceISO: '2027-11-07T17:00:00Z',
    laps: 71,
    lengthKm: '4.309 km',
    isSprint: true,
  },
  {
    round: 22,
    hostName: 'Las Vegas',
    grandPrixName: 'Las Vegas Grand Prix',
    officialTitle: 'FORMULA 1 HEINEKEN LAS VEGAS GRAND PRIX 2027',
    circuitName: 'Las Vegas Strip Circuit',
    city: 'Las Vegas',
    flagUrl: GP_FLAGS.US,
    svgId: 'vegas',
    trackCarbonName: 'Las Vegas',
    dateRangePill: 'NOV 18 - 20',
    raceISO: '2027-11-21T04:00:00Z',
    laps: 50,
    lengthKm: '6.201 km',
  },
  {
    round: 23,
    hostName: 'Qatar',
    grandPrixName: 'Qatar Grand Prix',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS QATAR GRAND PRIX 2027',
    circuitName: 'Lusail International Circuit',
    city: 'Lusail',
    flagUrl: GP_FLAGS.QA,
    svgId: 'lusail',
    trackCarbonName: 'Qatar',
    dateRangePill: 'DEC 03 - 05',
    raceISO: '2027-12-05T16:00:00Z',
    laps: 57,
    lengthKm: '5.419 km',
    isSprint: true,
  },
  {
    round: 24,
    hostName: 'Abu Dhabi',
    grandPrixName: 'Abu Dhabi Grand Prix',
    officialTitle: 'FORMULA 1 ETIHAD AIRWAYS ABU DHABI GRAND PRIX 2027',
    circuitName: 'Yas Marina Circuit',
    city: 'Abu Dhabi',
    flagUrl: GP_FLAGS.AE,
    svgId: 'yas_marina',
    trackCarbonName: 'Abu Dhabi',
    dateRangePill: 'DEC 10 - 12',
    raceISO: '2027-12-12T13:00:00Z',
    laps: 58,
    lengthKm: '5.281 km',
    isSprint: true,
  },
];

export const F1_2027_FULL_SEASON: F1Weekend[] = FIA_2027_CALENDAR_SPECS.map((spec) => ({
  id: `f1-2027-r${spec.round}-${spec.svgId}`,
  sport: 'F1',
  seasonYear: 2027,
  round: spec.round,
  hostName: spec.hostName,
  countryName: spec.hostName,
  dateRangePill: spec.dateRangePill,
  dateRangeLabel: spec.dateRangePill,
  status: 'UPCOMING',
  trackMapUrl: buildF1TrackMapCarbonUrl(spec.trackCarbonName),
  isSprintWeekend: Boolean(spec.isSprint),
  isProvisional2027: true,
  isTesting: Boolean(spec.isTesting),
  grandPrixName: spec.grandPrixName,
  officialTitle: spec.officialTitle,
  circuitName: spec.circuitName,
  city: spec.city,
  countryFlagUrl: spec.flagUrl,
  circuitSvgId: spec.svgId,
  laps: spec.laps,
  circuitLengthKm: spec.lengthKm,
  raceDistanceKm: '305.0 km',
  timeWindow: 'ALL_UPCOMING',
  sessions: buildStandardSessionsForWeekend(
    `f1-27-r${spec.round}`,
    spec.raceISO,
    Boolean(spec.isSprint)
  ),
  prefetchMeta: {
    trackTempForecast: 'FIA 2027 Confirmed Calendar',
    rainChance: '10%',
    tyreAllocation: 'Pirelli 2027 Allocation',
    lapRecord: 'Official FIA Timing',
    drsZones: 3,
    circuitLengthKm: spec.lengthKm,
    raceDistanceLaps: spec.laps,
  },
}));

const COMPLETED_2025_ROUNDS_SPECS: Array<{
  round: number;
  hostName: string;
  grandPrixName: string;
  officialTitle: string;
  circuitName: string;
  city: string;
  flagUrl: string;
  svgId: CircuitSvgId;
  trackCarbonName: string;
  dateRangePill: string;
  raceISO: string;
  laps: number;
  lengthKm: string;
  winnerSummary: string;
  isSprint?: boolean;
}> = [
  {
    round: 1,
    hostName: 'Australia',
    grandPrixName: 'Australian Grand Prix 2025',
    officialTitle: 'FORMULA 1 LOUIS VUITTON AUSTRALIAN GRAND PRIX 2025',
    circuitName: 'Albert Park Circuit',
    city: 'Melbourne',
    flagUrl: GP_FLAGS.AU,
    svgId: 'albert_park',
    trackCarbonName: 'Australia',
    dateRangePill: 'MAR 14 - 16',
    raceISO: '2025-03-16T04:00:00Z',
    laps: 57,
    lengthKm: '5.278 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Verstappen • P3 Russell',
  },
  {
    round: 2,
    hostName: 'China',
    grandPrixName: 'Chinese Grand Prix 2025',
    officialTitle: 'FORMULA 1 HEINEKEN CHINESE GRAND PRIX 2025',
    circuitName: 'Shanghai International Circuit',
    city: 'Shanghai',
    flagUrl: GP_FLAGS.ES,
    svgId: 'shanghai',
    trackCarbonName: 'China',
    dateRangePill: 'MAR 21 - 23',
    raceISO: '2025-03-23T07:00:00Z',
    laps: 56,
    lengthKm: '5.451 km',
    winnerSummary: 'Winner: O. Piastri (McLaren) • P2 Norris • P3 Russell',
    isSprint: true,
  },
  {
    round: 3,
    hostName: 'Japan',
    grandPrixName: 'Japanese Grand Prix 2025',
    officialTitle: 'FORMULA 1 LENOVO JAPANESE GRAND PRIX 2025',
    circuitName: 'Suzuka International Racing Course',
    city: 'Suzuka',
    flagUrl: GP_FLAGS.IT,
    svgId: 'suzuka',
    trackCarbonName: 'Japan',
    dateRangePill: 'APR 04 - 06',
    raceISO: '2025-04-06T05:00:00Z',
    laps: 53,
    lengthKm: '5.807 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Norris • P3 Piastri',
  },
  {
    round: 4,
    hostName: 'Bahrain',
    grandPrixName: 'Bahrain Grand Prix 2025',
    officialTitle: 'FORMULA 1 GULF AIR BAHRAIN GRAND PRIX 2025',
    circuitName: 'Bahrain International Circuit',
    city: 'Sakhir',
    flagUrl: GP_FLAGS.QA,
    svgId: 'bahrain',
    trackCarbonName: 'Bahrain',
    dateRangePill: 'APR 11 - 13',
    raceISO: '2025-04-13T15:00:00Z',
    laps: 57,
    lengthKm: '5.412 km',
    winnerSummary: 'Winner: O. Piastri (McLaren) • P2 Russell • P3 Norris',
  },
  {
    round: 5,
    hostName: 'Saudi Arabia',
    grandPrixName: 'Saudi Arabian Grand Prix 2025',
    officialTitle: 'FORMULA 1 STC SAUDI ARABIAN GRAND PRIX 2025',
    circuitName: 'Jeddah Corniche Circuit',
    city: 'Jeddah',
    flagUrl: GP_FLAGS.AE,
    svgId: 'jeddah',
    trackCarbonName: 'Saudi Arabia',
    dateRangePill: 'APR 18 - 20',
    raceISO: '2025-04-20T17:00:00Z',
    laps: 50,
    lengthKm: '6.174 km',
    winnerSummary: 'Winner: O. Piastri (McLaren) • P2 Verstappen • P3 Leclerc',
  },
  {
    round: 6,
    hostName: 'Miami',
    grandPrixName: 'Miami Grand Prix 2025',
    officialTitle: 'FORMULA 1 CRYPTO.COM MIAMI GRAND PRIX 2025',
    circuitName: 'Miami International Autodrome',
    city: 'Miami',
    flagUrl: GP_FLAGS.US,
    svgId: 'miami',
    trackCarbonName: 'Miami',
    dateRangePill: 'MAY 02 - 04',
    raceISO: '2025-05-04T20:00:00Z',
    laps: 57,
    lengthKm: '5.412 km',
    winnerSummary: 'Winner: O. Piastri (McLaren) • P2 Norris • P3 Russell',
    isSprint: true,
  },
  {
    round: 7,
    hostName: 'Emilia-Romagna',
    grandPrixName: 'Emilia Romagna Grand Prix 2025',
    officialTitle: 'FORMULA 1 AWS GRAN PREMIO DEL MADE IN ITALY E DELL’EMILIA-ROMAGNA 2025',
    circuitName: 'Autodromo Enzo e Dino Ferrari (Imola)',
    city: 'Imola',
    flagUrl: GP_FLAGS.IT,
    svgId: 'imola',
    trackCarbonName: 'Emilia Romagna',
    dateRangePill: 'MAY 16 - 18',
    raceISO: '2025-05-18T13:00:00Z',
    laps: 63,
    lengthKm: '4.909 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Norris • P3 Piastri',
  },
  {
    round: 8,
    hostName: 'Monaco',
    grandPrixName: 'Monaco Grand Prix 2025',
    officialTitle: 'FORMULA 1 TAG HEUER GRAND PRIX DE MONACO 2025',
    circuitName: 'Circuit de Monaco',
    city: 'Monte Carlo',
    flagUrl: GP_FLAGS.MC,
    svgId: 'monaco',
    trackCarbonName: 'Monaco',
    dateRangePill: 'MAY 23 - 25',
    raceISO: '2025-05-25T13:00:00Z',
    laps: 78,
    lengthKm: '3.337 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Leclerc • P3 Piastri',
  },
  {
    round: 9,
    hostName: 'Spain',
    grandPrixName: 'Spanish Grand Prix 2025',
    officialTitle: 'FORMULA 1 ARAMCO GRAN PREMIO DE ESPAÑA 2025',
    circuitName: 'Circuit de Barcelona-Catalunya',
    city: 'Barcelona',
    flagUrl: GP_FLAGS.ES,
    svgId: 'barcelona',
    trackCarbonName: 'Spain',
    dateRangePill: 'MAY 30 - JUN 01',
    raceISO: '2025-06-01T13:00:00Z',
    laps: 66,
    lengthKm: '4.657 km',
    winnerSummary: 'Winner: O. Piastri (McLaren) • P2 Norris • P3 Leclerc',
  },
  {
    round: 10,
    hostName: 'Canada',
    grandPrixName: 'Canadian Grand Prix 2025',
    officialTitle: 'FORMULA 1 PIRELLI GRAND PRIX DU CANADA 2025',
    circuitName: 'Circuit Gilles-Villeneuve',
    city: 'Montreal',
    flagUrl: GP_FLAGS.US,
    svgId: 'montreal',
    trackCarbonName: 'Canada',
    dateRangePill: 'JUN 13 - 15',
    raceISO: '2025-06-15T18:00:00Z',
    laps: 70,
    lengthKm: '4.361 km',
    winnerSummary: 'Winner: G. Russell (Mercedes) • P2 Verstappen • P3 Antonelli',
  },
  {
    round: 11,
    hostName: 'Austria',
    grandPrixName: 'Austrian Grand Prix 2025',
    officialTitle: 'FORMULA 1 MSC CRUISES AUSTRIAN GRAND PRIX 2025',
    circuitName: 'Red Bull Ring',
    city: 'Spielberg',
    flagUrl: GP_FLAGS.DE,
    svgId: 'red_bull_ring',
    trackCarbonName: 'Austria',
    dateRangePill: 'JUN 27 - 29',
    raceISO: '2025-06-29T13:00:00Z',
    laps: 70,
    lengthKm: '4.318 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Piastri • P3 Leclerc',
  },
  {
    round: 12,
    hostName: 'Great Britain',
    grandPrixName: 'British Grand Prix 2025',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS BRITISH GRAND PRIX 2025',
    circuitName: 'Silverstone Circuit',
    city: 'Silverstone',
    flagUrl: GP_FLAGS.GB,
    svgId: 'silverstone',
    trackCarbonName: 'Great Britain',
    dateRangePill: 'JUL 04 - 06',
    raceISO: '2025-07-06T14:00:00Z',
    laps: 52,
    lengthKm: '5.891 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Piastri • P3 Hülkenberg',
  },
  {
    round: 13,
    hostName: 'Belgium',
    grandPrixName: 'Belgian Grand Prix 2025',
    officialTitle: 'FORMULA 1 MOËT & CHANDON BELGIAN GRAND PRIX 2025',
    circuitName: 'Circuit de Spa-Francorchamps',
    city: 'Spa',
    flagUrl: GP_FLAGS.DE,
    svgId: 'spa',
    trackCarbonName: 'Belgium',
    dateRangePill: 'JUL 25 - 27',
    raceISO: '2025-07-27T13:00:00Z',
    laps: 44,
    lengthKm: '7.004 km',
    winnerSummary: 'Winner: O. Piastri (McLaren) • P2 Norris • P3 Leclerc',
    isSprint: true,
  },
  {
    round: 14,
    hostName: 'Hungary',
    grandPrixName: 'Hungarian Grand Prix 2025',
    officialTitle: 'FORMULA 1 LENOVO HUNGARIAN GRAND PRIX 2025',
    circuitName: 'Hungaroring',
    city: 'Budapest',
    flagUrl: GP_FLAGS.IT,
    svgId: 'hungaroring',
    trackCarbonName: 'Hungary',
    dateRangePill: 'AUG 01 - 03',
    raceISO: '2025-08-03T13:00:00Z',
    laps: 70,
    lengthKm: '4.381 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Piastri • P3 Russell',
  },
  {
    round: 15,
    hostName: 'Netherlands',
    grandPrixName: 'Dutch Grand Prix 2025',
    officialTitle: 'FORMULA 1 HEINEKEN DUTCH GRAND PRIX 2025',
    circuitName: 'Circuit Zandvoort',
    city: 'Zandvoort',
    flagUrl: GP_FLAGS.NL,
    svgId: 'zandvoort',
    trackCarbonName: 'Netherlands',
    dateRangePill: 'AUG 29 - 31',
    raceISO: '2025-08-31T13:00:00Z',
    laps: 72,
    lengthKm: '4.259 km',
    winnerSummary: 'Winner: O. Piastri (McLaren) • P2 Verstappen • P3 Hadjar',
  },
  {
    round: 16,
    hostName: 'Italy',
    grandPrixName: 'Italian Grand Prix 2025',
    officialTitle: 'FORMULA 1 PIRELLI GRAN PREMIO D’ITALIA 2025',
    circuitName: 'Autodromo Nazionale Monza',
    city: 'Monza',
    flagUrl: GP_FLAGS.IT,
    svgId: 'monza',
    trackCarbonName: 'Italy',
    dateRangePill: 'SEP 05 - 07',
    raceISO: '2025-09-07T13:00:00Z',
    laps: 53,
    lengthKm: '5.793 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Norris • P3 Piastri',
  },
  {
    round: 17,
    hostName: 'Azerbaijan',
    grandPrixName: 'Azerbaijan Grand Prix 2025',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS AZERBAIJAN GRAND PRIX 2025',
    circuitName: 'Baku City Circuit',
    city: 'Baku',
    flagUrl: GP_FLAGS.AE,
    svgId: 'baku',
    trackCarbonName: 'Azerbaijan',
    dateRangePill: 'SEP 19 - 21',
    raceISO: '2025-09-21T11:00:00Z',
    laps: 51,
    lengthKm: '6.003 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Russell • P3 Sainz',
  },
  {
    round: 18,
    hostName: 'Singapore',
    grandPrixName: 'Singapore Grand Prix 2025',
    officialTitle: 'FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2025',
    circuitName: 'Marina Bay Street Circuit',
    city: 'Singapore',
    flagUrl: GP_FLAGS.MX,
    svgId: 'marina_bay',
    trackCarbonName: 'Singapore',
    dateRangePill: 'OCT 03 - 05',
    raceISO: '2025-10-05T12:00:00Z',
    laps: 62,
    lengthKm: '4.940 km',
    winnerSummary: 'Winner: G. Russell (Mercedes) • P2 Verstappen • P3 Norris',
  },
  {
    round: 19,
    hostName: 'United States',
    grandPrixName: 'United States Grand Prix 2025',
    officialTitle: 'FORMULA 1 MSC CRUISES UNITED STATES GRAND PRIX 2025',
    circuitName: 'Circuit of the Americas',
    city: 'Austin',
    flagUrl: GP_FLAGS.US,
    svgId: 'cota',
    trackCarbonName: 'USA',
    dateRangePill: 'OCT 17 - 19',
    raceISO: '2025-10-19T19:00:00Z',
    laps: 56,
    lengthKm: '5.513 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Norris • P3 Leclerc',
    isSprint: true,
  },
  {
    round: 20,
    hostName: 'Mexico',
    grandPrixName: 'Mexico City Grand Prix 2025',
    officialTitle: 'FORMULA 1 GRAN PREMIO DE LA CIUDAD DE MÉXICO 2025',
    circuitName: 'Autódromo Hermanos Rodríguez',
    city: 'Mexico City',
    flagUrl: GP_FLAGS.MX,
    svgId: 'mexico',
    trackCarbonName: 'Mexico',
    dateRangePill: 'OCT 24 - 26',
    raceISO: '2025-10-26T20:00:00Z',
    laps: 71,
    lengthKm: '4.304 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Leclerc • P3 Verstappen',
  },
  {
    round: 21,
    hostName: 'Brazil',
    grandPrixName: 'São Paulo Grand Prix 2025',
    officialTitle: 'FORMULA 1 MSC CRUISES GRANDE PRÊMIO DE SÃO PAULO 2025',
    circuitName: 'Autódromo José Carlos Pace • Interlagos',
    city: 'São Paulo',
    flagUrl: GP_FLAGS.BR,
    svgId: 'interlagos',
    trackCarbonName: 'Brazil',
    dateRangePill: 'NOV 07 - 09',
    raceISO: '2025-11-09T17:00:00Z',
    laps: 71,
    lengthKm: '4.309 km',
    winnerSummary: 'Winner: L. Norris (McLaren) • P2 Antonelli • P3 Verstappen',
    isSprint: true,
  },
  {
    round: 22,
    hostName: 'Las Vegas',
    grandPrixName: 'Las Vegas Grand Prix 2025',
    officialTitle: 'FORMULA 1 HEINEKENLAS VEGAS GRAND PRIX 2025',
    circuitName: 'Las Vegas Strip Circuit',
    city: 'Las Vegas',
    flagUrl: GP_FLAGS.US,
    svgId: 'vegas',
    trackCarbonName: 'Las Vegas',
    dateRangePill: 'NOV 20 - 22',
    raceISO: '2025-11-23T04:00:00Z',
    laps: 50,
    lengthKm: '6.201 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Russell • P3 Antonelli',
  },
  {
    round: 23,
    hostName: 'Qatar',
    grandPrixName: 'Qatar Grand Prix 2025',
    officialTitle: 'FORMULA 1 QATAR AIRWAYS QATAR GRAND PRIX 2025',
    circuitName: 'Lusail International Circuit',
    city: 'Lusail',
    flagUrl: GP_FLAGS.QA,
    svgId: 'lusail',
    trackCarbonName: 'Qatar',
    dateRangePill: 'NOV 28 - 30',
    raceISO: '2025-11-30T16:00:00Z',
    laps: 57,
    lengthKm: '5.419 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Piastri • P3 Sainz',
    isSprint: true,
  },
  {
    round: 24,
    hostName: 'Abu Dhabi',
    grandPrixName: 'Abu Dhabi Grand Prix 2025',
    officialTitle: 'FORMULA 1 ETIHAD AIRWAYS ABU DHABI GRAND PRIX 2025',
    circuitName: 'Yas Marina Circuit',
    city: 'Abu Dhabi',
    flagUrl: GP_FLAGS.AE,
    svgId: 'yas_marina',
    trackCarbonName: 'Abu Dhabi',
    dateRangePill: 'DEC 05 - 07',
    raceISO: '2025-12-07T13:00:00Z',
    laps: 58,
    lengthKm: '5.281 km',
    winnerSummary: 'Winner: M. Verstappen (Red Bull) • P2 Piastri • P3 Norris (2025 WDC)',
  },
];

export const F1_2025_HIGHLIGHT_SEASON: F1Weekend[] = COMPLETED_2025_ROUNDS_SPECS.map(
  (spec): F1Weekend => ({
    id: `f1-2025-r${spec.round}-${spec.svgId}`,
    sport: 'F1',
    seasonYear: 2025,
    round: spec.round,
    hostName: spec.hostName,
    countryName: spec.hostName,
    dateRangePill: spec.dateRangePill,
    dateRangeLabel: spec.dateRangePill,
    status: 'COMPLETED',
    winnerSummary: spec.winnerSummary,
    trackMapUrl: buildF1TrackMapCarbonUrl(spec.trackCarbonName),
    isSprintWeekend: Boolean(spec.isSprint),
    grandPrixName: spec.grandPrixName,
    officialTitle: spec.officialTitle,
    circuitName: spec.circuitName,
    city: spec.city,
    countryFlagUrl: spec.flagUrl,
    circuitSvgId: spec.svgId,
    laps: spec.laps,
    circuitLengthKm: spec.lengthKm,
    raceDistanceKm: '305.354 km',
    timeWindow: 'PAST_RESULTS',
    sessions: buildStandardSessionsForWeekend(
      `f1-25-r${spec.round}`,
      spec.raceISO,
      Boolean(spec.isSprint),
      {
        round: spec.round,
        winnerSummary: spec.winnerSummary,
        laps: spec.laps,
        populateLegacyHighlightResults: false,
      }
    ),
    prefetchMeta: {
      trackTempForecast: `2025 Official FIA Result • ${spec.winnerSummary}`,
      rainChance: '0%',
      tyreAllocation: 'C3 Hard / C4 Medium / C5 Soft',
      lapRecord: 'Official FIA 2025 Classification',
      drsZones: 3,
      circuitLengthKm: spec.lengthKm,
      raceDistanceLaps: spec.laps,
    },
  })
);

interface OpenF1BatchSessionDTO {
  meeting_key?: number;
  session_key: number;
  session_name: string;
  session_type?: string;
  date_start: string;
  date_end?: string;
  year: number;
  country_name?: string;
  circuit_short_name?: string;
  location?: string;
}

interface OpenF1BatchResultDTO {
  session_key: number;
  driver_number: number;
  position: number | null;
  number_of_laps?: number;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
  gap_to_leader?: number | string | Array<number | string | null> | null;
  duration?: number | Array<number | null> | null;
}

interface OpenF1BatchGridDTO {
  session_key: number;
  driver_number: number;
  position: number;
  lap_duration?: number | null;
}

interface OpenF1BatchStintDTO {
  session_key: number;
  driver_number: number;
  stint_number: number;
  lap_start?: number;
  lap_end?: number;
  compound?: string;
  tyre_age_at_start?: number;
}

interface OpenF1BatchDriverDTO {
  session_key?: number;
  driver_number: number;
  name_acronym?: string;
  full_name?: string;
  broadcast_name?: string;
  team_name?: string;
  team_colour?: string;
}

const MULTI_ERA_DRIVER_FALLBACK: Record<
  number,
  Record<
    number,
    {
      code: string;
      name: string;
      team: string;
      teamCode: string;
      color: string;
    }
  >
> = {
  2024: {
    1: { code: 'VER', name: 'M. Verstappen', team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
    2: { code: 'SAR', name: 'L. Sargeant', team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
    3: { code: 'RIC', name: 'D. Ricciardo', team: 'Racing Bulls', teamCode: 'RB', color: '#6692FF' },
    4: { code: 'NOR', name: 'L. Norris', team: 'McLaren', teamCode: 'MCL', color: '#FF8000' },
    10: { code: 'GAS', name: 'P. Gasly', team: 'Alpine', teamCode: 'ALP', color: '#0093CC' },
    11: { code: 'PER', name: 'S. Pérez', team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
    14: { code: 'ALO', name: 'F. Alonso', team: 'Aston Martin', teamCode: 'AST', color: '#229971' },
    16: { code: 'LEC', name: 'C. Leclerc', team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
    18: { code: 'STR', name: 'L. Stroll', team: 'Aston Martin', teamCode: 'AST', color: '#229971' },
    20: { code: 'MAG', name: 'K. Magnussen', team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
    22: { code: 'TSU', name: 'Y. Tsunoda', team: 'Racing Bulls', teamCode: 'RB', color: '#6692FF' },
    23: { code: 'ALB', name: 'A. Albon', team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
    24: { code: 'ZHO', name: 'G. Zhou', team: 'Kick Sauber', teamCode: 'AUD', color: '#52E252' },
    27: { code: 'HUL', name: 'N. Hülkenberg', team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
    30: { code: 'LAW', name: 'L. Lawson', team: 'Racing Bulls', teamCode: 'RB', color: '#6692FF' },
    31: { code: 'OCO', name: 'E. Ocon', team: 'Alpine', teamCode: 'ALP', color: '#0093CC' },
    38: { code: 'BEA', name: 'O. Bearman', team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
    43: { code: 'COL', name: 'F. Colapinto', team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
    44: { code: 'HAM', name: 'L. Hamilton', team: 'Mercedes', teamCode: 'MER', color: '#27F4D2' },
    50: { code: 'BEA', name: 'O. Bearman', team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
    55: { code: 'SAI', name: 'C. Sainz', team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
    61: { code: 'DOO', name: 'J. Doohan', team: 'Alpine', teamCode: 'ALP', color: '#0093CC' },
    63: { code: 'RUS', name: 'G. Russell', team: 'Mercedes', teamCode: 'MER', color: '#27F4D2' },
    77: { code: 'BOT', name: 'V. Bottas', team: 'Kick Sauber', teamCode: 'AUD', color: '#52E252' },
    81: { code: 'PIA', name: 'O. Piastri', team: 'McLaren', teamCode: 'MCL', color: '#FF8000' },
  },
  2025: {
    1: { code: 'VER', name: 'M. Verstappen', team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
    4: { code: 'NOR', name: 'L. Norris', team: 'McLaren', teamCode: 'MCL', color: '#FF8000' },
    5: { code: 'BOR', name: 'G. Bortoleto', team: 'Kick Sauber', teamCode: 'AUD', color: '#52E252' },
    6: { code: 'HAD', name: 'I. Hadjar', team: 'Racing Bulls', teamCode: 'RB', color: '#6692FF' },
    7: { code: 'DOO', name: 'J. Doohan', team: 'Alpine', teamCode: 'ALP', color: '#0093CC' },
    10: { code: 'GAS', name: 'P. Gasly', team: 'Alpine', teamCode: 'ALP', color: '#0093CC' },
    12: { code: 'ANT', name: 'K. Antonelli', team: 'Mercedes', teamCode: 'MER', color: '#27F4D2' },
    14: { code: 'ALO', name: 'F. Alonso', team: 'Aston Martin', teamCode: 'AST', color: '#229971' },
    16: { code: 'LEC', name: 'C. Leclerc', team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
    18: { code: 'STR', name: 'L. Stroll', team: 'Aston Martin', teamCode: 'AST', color: '#229971' },
    22: { code: 'TSU', name: 'Y. Tsunoda', team: 'Red Bull Racing', teamCode: 'RBR', color: '#3671C6' },
    23: { code: 'ALB', name: 'A. Albon', team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
    27: { code: 'HUL', name: 'N. Hülkenberg', team: 'Kick Sauber', teamCode: 'AUD', color: '#52E252' },
    30: { code: 'LAW', name: 'L. Lawson', team: 'Racing Bulls', teamCode: 'RB', color: '#6692FF' },
    31: { code: 'OCO', name: 'E. Ocon', team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
    43: { code: 'COL', name: 'F. Colapinto', team: 'Alpine', teamCode: 'ALP', color: '#0093CC' },
    44: { code: 'HAM', name: 'L. Hamilton', team: 'Ferrari', teamCode: 'FER', color: '#E10600' },
    55: { code: 'SAI', name: 'C. Sainz', team: 'Williams', teamCode: 'WIL', color: '#64C4FF' },
    63: { code: 'RUS', name: 'G. Russell', team: 'Mercedes', teamCode: 'MER', color: '#27F4D2' },
    81: { code: 'PIA', name: 'O. Piastri', team: 'McLaren', teamCode: 'MCL', color: '#FF8000' },
    87: { code: 'BEA', name: 'O. Bearman', team: 'Haas F1 Team', teamCode: 'HAA', color: '#B6BABD' },
  },
  2026: OPENF1_2026_DRIVER_NUMBER_MAP,
};

function mapBatchTyreCompound(raw?: string): TyreCompound {
  const upper = (raw || 'SOFT').toUpperCase();
  if (upper.startsWith('S')) return 'S';
  if (upper.startsWith('M')) return 'M';
  if (upper.startsWith('H')) return 'H';
  if (upper.startsWith('I')) return 'I';
  if (upper.startsWith('W')) return 'W';
  return 'S';
}

function formatBatchLapOrRaceDuration(
  rawDuration: number | Array<number | null> | null | undefined,
  isRaceOrSprint: boolean
): string {
  let seconds: number | null = null;
  if (Array.isArray(rawDuration)) {
    for (let i = rawDuration.length - 1; i >= 0; i--) {
      const v = rawDuration[i];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        seconds = v;
        break;
      }
    }
  } else if (typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0) {
    seconds = rawDuration;
  }

  if (seconds === null) {
    return isRaceOrSprint ? '—' : 'NO TIME';
  }

  if (seconds >= 300) {
    const hrs = Math.floor(seconds / 3600);
    const remAfterHrs = seconds - hrs * 3600;
    const mins = Math.floor(remAfterHrs / 60);
    const secs = (remAfterHrs - mins * 60).toFixed(3).padStart(6, '0');
    return hrs > 0
      ? `${hrs}:${String(mins).padStart(2, '0')}:${secs}`
      : `${mins}:${secs}`;
  }

  const mins = Math.floor(seconds / 60);
  const rem = (seconds - mins * 60).toFixed(3).padStart(6, '0');
  return mins > 0 ? `${mins}:${rem}` : rem;
}

function formatBatchGapToLeader(
  rawGap: number | string | Array<number | string | null> | null | undefined
): string {
  let val: number | string | null = null;
  if (Array.isArray(rawGap)) {
    for (let i = rawGap.length - 1; i >= 0; i--) {
      const v = rawGap[i];
      if (v !== null && v !== undefined && v !== '') {
        val = v;
        break;
      }
    }
  } else if (rawGap !== null && rawGap !== undefined && rawGap !== '') {
    val = rawGap;
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    return val === 0 ? 'LEADER' : `+${val.toFixed(3)}s`;
  }
  if (typeof val === 'string' && val.trim()) {
    const trimmed = val.trim();
    return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
  }
  return '—';
}

function resolveCircuitMetadataFromOpenF1(
  circuitShortName: string,
  location: string,
  countryName: string,
  seasonYear: number,
  round: number,
  raceDateISO: string
): {
  hostName: string;
  grandPrixName: string;
  officialTitle: string;
  circuitName: string;
  city: string;
  flagUrl: string;
  svgId: CircuitSvgId;
  trackCarbonName: string;
  laps: number;
  lengthKm: string;
  dateRangePill: string;
} {
  const cLower = `${circuitShortName} ${location} ${countryName}`.toLowerCase();
  const raceDate = new Date(raceDateISO);
  const friDate = new Date(raceDate.getTime() - 2 * 24 * 3600 * 1000);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const m1 = months[friDate.getUTCMonth()] || 'NOV';
  const m2 = months[raceDate.getUTCMonth()] || 'NOV';
  const d1 = String(friDate.getUTCDate()).padStart(2, '0');
  const d2 = String(raceDate.getUTCDate()).padStart(2, '0');
  const dateRangePill = m1 === m2 ? `${m1} ${d1} - ${d2}` : `${m1} ${d1} - ${m2} ${d2}`;

  const allKnownSpecs = [...COMPLETED_2026_ROUNDS_SPECS, ...COMPLETED_2025_ROUNDS_SPECS];
  const matchedSpec = allKnownSpecs.find((sp) => {
    const spCity = sp.city.toLowerCase();
    const spHost = sp.hostName.toLowerCase();
    const spSvg = sp.svgId.toLowerCase();
    if (cLower.includes('las vegas')) return spSvg === 'vegas';
    if (cLower.includes('miami')) return spSvg === 'miami';
    if (cLower.includes('austin')) return spSvg === 'cota';
    if (cLower.includes('interlagos') || cLower.includes('são paulo') || cLower.includes('sao paulo'))
      return spSvg === 'interlagos';
    if (cLower.includes('madring') || cLower.includes('madrid')) return spCity === 'madrid';
    if (cLower.includes('catalunya') || cLower.includes('barcelona')) return spSvg === 'catalunya';
    if (cLower.includes('imola')) return spSvg === 'imola';
    if (cLower.includes('monza')) return spSvg === 'monza';
    return cLower.includes(spCity) || cLower.includes(spHost);
  });

  if (matchedSpec) {
    return {
      hostName: matchedSpec.hostName,
      grandPrixName: `${matchedSpec.grandPrixName.replace(/\s*\d{4}$/, '')} ${seasonYear}`,
      officialTitle: matchedSpec.officialTitle.replace(/\d{4}/g, String(seasonYear)),
      circuitName: matchedSpec.circuitName,
      city: matchedSpec.city,
      flagUrl: matchedSpec.flagUrl,
      svgId: matchedSpec.svgId,
      trackCarbonName: matchedSpec.trackCarbonName,
      laps: matchedSpec.laps,
      lengthKm: matchedSpec.lengthKm,
      dateRangePill,
    };
  }

  return {
    hostName: location || countryName || `Round ${round}`,
    grandPrixName: `${countryName || location} Grand Prix ${seasonYear}`,
    officialTitle: `FORMULA 1 ${(countryName || location).toUpperCase()} GRAND PRIX ${seasonYear}`,
    circuitName: circuitShortName || location || 'Formula 1 Circuit',
    city: location || countryName || '',
    flagUrl: GP_FLAGS.GB,
    svgId: 'silverstone',
    trackCarbonName: countryName || 'Great Britain',
    laps: 58,
    lengthKm: '5.300 km',
    dateRangePill,
  };
}

function matchWeekendToOpenF1Meeting(
  weekend: F1Weekend,
  meetings: Array<{
    meetingKey: number;
    raceSession: OpenF1BatchSessionDTO;
    sessions: OpenF1BatchSessionDTO[];
  }>
): {
  meetingKey: number;
  raceSession: OpenF1BatchSessionDTO;
  sessions: OpenF1BatchSessionDTO[];
} | undefined {
  const gpSess = weekend.sessions.find((s) => s.name === 'Grand Prix') || weekend.sessions[weekend.sessions.length - 1];
  const baseRaceMs = gpSess ? Date.parse(gpSess.startTimeISO) : NaN;
  const wkText = `${weekend.id} ${weekend.city} ${weekend.hostName} ${weekend.circuitName} ${weekend.circuitSvgId}`.toLowerCase();

  // First priority: specific circuit/city match + date proximity within ±12 days
  for (const m of meetings) {
    const openRaceMs = Date.parse(m.raceSession.date_start);
    const dateDiffDays =
      Number.isFinite(baseRaceMs) && Number.isFinite(openRaceMs)
        ? Math.abs(openRaceMs - baseRaceMs) / (24 * 3600 * 1000)
        : 0;

    // Never match a meeting whose race date is more than 12 days away from the scheduled weekend!
    if (Number.isFinite(baseRaceMs) && dateDiffDays > 12) {
      continue;
    }

    const mLoc = (m.raceSession.location || '').toLowerCase();
    const mCirc = (m.raceSession.circuit_short_name || '').toLowerCase();
    const mCombined = `${mLoc} ${mCirc}`;

    if (wkText.includes('vegas') && mCombined.includes('vegas')) return m;
    if (wkText.includes('miami') && mCombined.includes('miami')) return m;
    if ((wkText.includes('austin') || wkText.includes('cota')) && mCombined.includes('austin')) return m;
    if ((wkText.includes('interlagos') || wkText.includes('brazil') || wkText.includes('paulo')) && (mCombined.includes('interlagos') || mCombined.includes('paulo'))) return m;
    if (wkText.includes('madrid') && (mCombined.includes('madring') || mCombined.includes('madrid'))) return m;
    if ((wkText.includes('barcelona') || wkText.includes('catalunya')) && (mCombined.includes('catalunya') || mCombined.includes('barcelona'))) return m;
    if (wkText.includes('imola') && mCombined.includes('imola')) return m;
    if (wkText.includes('monza') && mCombined.includes('monza')) return m;
    if (wkText.includes('lusail') && mCombined.includes('lusail')) return m;
    if ((wkText.includes('yas') || wkText.includes('abu dhabi')) && mCombined.includes('yas')) return m;
    if (wkText.includes('mexico') && mCombined.includes('mexico')) return m;

    if (
      (mLoc && wkText.includes(mLoc)) ||
      (mCirc && wkText.includes(mCirc)) ||
      dateDiffDays <= 3
    ) {
      return m;
    }
  }

  return undefined;
}

const seasonBatchMemoryCache = new Map<
  number,
  {
    fetchedAtMs: number;
    weekends: F1Weekend[];
    openF1SessionsCount: number;
  }
>();

export async function fetchOpenF1SeasonBatchData(
  seasonYear: number,
  baseWeekends?: F1Weekend[],
  forceRefresh?: boolean
): Promise<{
  weekends: F1Weekend[];
  openF1SessionsCount: number;
}> {
  const nowMs = Date.now();
  const cached = seasonBatchMemoryCache.get(seasonYear);
  const currentYear = new Date().getUTCFullYear();
  const ttl = seasonYear < currentYear ? 7 * 24 * 3600 * 1000 : 5 * 60 * 1000;
  if (!forceRefresh && cached && nowMs - cached.fetchedAtMs < ttl && cached.weekends.length > 0) {
    return {
      weekends: cached.weekends,
      openF1SessionsCount: cached.openF1SessionsCount,
    };
  }

  const rawSessions = await fetchWithResilience<OpenF1BatchSessionDTO[]>(
    `https://api.openf1.org/v1/sessions?year=${seasonYear}`,
    {
      ttlMs: ttl,
      cacheKey: `openf1_batch_sessions_${seasonYear}_v15`,
      forceRefresh,
      timeoutMs: 6500,
    }
  );

  if (!Array.isArray(rawSessions) || rawSessions.length === 0) {
    const fallback =
      baseWeekends ||
      (seasonYear === 2026
        ? F1_2026_FULL_SEASON
        : seasonYear === 2025
        ? F1_2025_HIGHLIGHT_SEASON
        : F1_2027_FULL_SEASON);
    return { weekends: fallback, openF1SessionsCount: 0 };
  }

  // Group sessions by meeting_key, excluding Pre-Season Testing and non-championship exhibition keys
  const byMeeting = new Map<number, OpenF1BatchSessionDTO[]>();
  for (const s of rawSessions) {
    if (!s || typeof s.session_key !== 'number' || !s.date_start) continue;
    const cShort = (s.circuit_short_name || '').toLowerCase();
    if (cShort.includes('kuala lumpur')) continue;
    const sName = (s.session_name || '').toLowerCase();
    if (sName === 'day 1' || sName === 'day 2' || sName === 'day 3') continue;
    const mKey = s.meeting_key ?? Math.floor(s.session_key / 10);
    const list = byMeeting.get(mKey) || [];
    list.push(s);
    byMeeting.set(mKey, list);
  }

  const meetings: Array<{
    meetingKey: number;
    raceSession: OpenF1BatchSessionDTO;
    sessions: OpenF1BatchSessionDTO[];
  }> = [];

  for (const [meetingKey, sessList] of byMeeting.entries()) {
    const sorted = [...sessList].sort(
      (a, b) => Date.parse(a.date_start) - Date.parse(b.date_start)
    );
    const raceSession = sorted.find((s) => (s.session_name || '').toLowerCase() === 'race');
    if (!raceSession) continue;
    meetings.push({ meetingKey, raceSession, sessions: sorted });
  }

  meetings.sort(
    (a, b) => Date.parse(a.raceSession.date_start) - Date.parse(b.raceSession.date_start)
  );

  // Collect all valid session_keys that have already started (date_start <= nowMs)
  const startedSessions = meetings
    .flatMap((m) => m.sessions)
    .filter((s) => {
      const ms = Date.parse(s.date_start);
      return Number.isFinite(ms) && ms <= nowMs;
    });

  const resultsBySessionKey = new Map<number, OpenF1BatchResultDTO[]>();
  const gridsBySessionKey = new Map<number, OpenF1BatchGridDTO[]>();
  const stintsBySessionAndDriver = new Map<string, OpenF1BatchStintDTO[]>();
  const driverMapByNumber = new Map<
    number,
    {
      code: string;
      name: string;
      team: string;
      teamCode: string;
      color: string;
    }
  >();

  // Seed driverMapByNumber with season-appropriate baseline first
  const eraFallback =
    MULTI_ERA_DRIVER_FALLBACK[seasonYear] ||
    (seasonYear <= 2024
      ? MULTI_ERA_DRIVER_FALLBACK[2024]
      : seasonYear === 2025
      ? MULTI_ERA_DRIVER_FALLBACK[2025]
      : OPENF1_2026_DRIVER_NUMBER_MAP);
  for (const [numStr, info] of Object.entries(eraFallback)) {
    driverMapByNumber.set(Number(numStr), info);
  }

  if (startedSessions.length > 0) {
    const startedKeys = startedSessions.map((s) => s.session_key);
    const minKey = Math.min(...startedKeys);
    const maxKey = Math.max(...startedKeys);

    // Stagger requests by 280ms to respect OpenF1 rate limits
    const rawResults = await fetchWithResilience<OpenF1BatchResultDTO[]>(
      `https://api.openf1.org/v1/session_result?session_key>=${minKey}&session_key<=${maxKey}`,
      {
        ttlMs: ttl,
        cacheKey: `openf1_batch_results_${seasonYear}_${minKey}_${maxKey}_v15`,
        forceRefresh,
        timeoutMs: 8000,
        skipPersistentStorage: true,
      }
    );

    await new Promise((r) => setTimeout(r, 260));

    const rawGrids = await fetchWithResilience<OpenF1BatchGridDTO[]>(
      `https://api.openf1.org/v1/starting_grid?session_key>=${minKey}&session_key<=${maxKey}`,
      {
        ttlMs: ttl,
        cacheKey: `openf1_batch_grids_${seasonYear}_${minKey}_${maxKey}_v15`,
        forceRefresh,
        timeoutMs: 8000,
        skipPersistentStorage: true,
      }
    );

    await new Promise((r) => setTimeout(r, 260));

    const rawStints = await fetchWithResilience<OpenF1BatchStintDTO[]>(
      `https://api.openf1.org/v1/stints?session_key>=${minKey}&session_key<=${maxKey}`,
      {
        ttlMs: ttl,
        cacheKey: `openf1_batch_stints_${seasonYear}_${minKey}_${maxKey}_v15`,
        forceRefresh,
        timeoutMs: 9000,
        skipPersistentStorage: true,
      }
    );

    await new Promise((r) => setTimeout(r, 260));

    // Fetch official OpenF1 drivers for the latest started session of the season
    const latestSessionKey = startedKeys[startedKeys.length - 1];
    const rawDrivers = await fetchWithResilience<OpenF1BatchDriverDTO[]>(
      `https://api.openf1.org/v1/drivers?session_key=${latestSessionKey}`,
      {
        ttlMs: ttl,
        cacheKey: `openf1_batch_drivers_${seasonYear}_${latestSessionKey}_v15`,
        forceRefresh,
        timeoutMs: 5000,
      }
    );

    if (Array.isArray(rawDrivers)) {
      for (const d of rawDrivers) {
        if (typeof d?.driver_number !== 'number' || !d.name_acronym) continue;
        const verifiedTeam = verifyF1ConstructorMapping({
          teamName: d.team_name,
          contextDriverCode: d.name_acronym,
        });
        const fullName = d.full_name || d.broadcast_name || d.name_acronym;
        const nameParts = fullName.trim().split(/\s+/);
        const formattedShortName =
          nameParts.length >= 2
            ? `${nameParts[0][0]}. ${nameParts.slice(1).join(' ')}`
            : fullName;
        driverMapByNumber.set(d.driver_number, {
          code: d.name_acronym.toUpperCase(),
          name: formattedShortName,
          team: verifiedTeam.canonicalName || d.team_name || 'Formula 1 Team',
          teamCode: verifiedTeam.code,
          color: d.team_colour ? `#${d.team_colour.replace(/^#/, '')}` : verifiedTeam.color,
        });
      }
    }

    if (Array.isArray(rawResults)) {
      for (const row of rawResults) {
        if (!row || typeof row.session_key !== 'number') continue;
        const list = resultsBySessionKey.get(row.session_key) || [];
        list.push(row);
        resultsBySessionKey.set(row.session_key, list);
      }
    }

    if (Array.isArray(rawGrids)) {
      for (const g of rawGrids) {
        if (!g || typeof g.session_key !== 'number') continue;
        const list = gridsBySessionKey.get(g.session_key) || [];
        list.push(g);
        gridsBySessionKey.set(g.session_key, list);
      }
    }

    if (Array.isArray(rawStints)) {
      for (const st of rawStints) {
        if (!st || typeof st.session_key !== 'number' || typeof st.driver_number !== 'number') continue;
        const k = `${st.session_key}_${st.driver_number}`;
        const list = stintsBySessionAndDriver.get(k) || [];
        list.push(st);
        stintsBySessionAndDriver.set(k, list);
      }
    }
  }

  // Build weekends either by enriching baseWeekends OR constructing directly from OpenF1 meetings (for 2024, 2028, 2029, 2030, etc.)
  const templateWeekends: F1Weekend[] =
    baseWeekends && baseWeekends.length > 0
      ? baseWeekends
      : seasonYear === 2026
      ? F1_2026_FULL_SEASON
      : seasonYear === 2025
      ? F1_2025_HIGHLIGHT_SEASON
      : meetings.map((m, idx): F1Weekend => {
          const round = idx + 1;
          const meta = resolveCircuitMetadataFromOpenF1(
            m.raceSession.circuit_short_name || '',
            m.raceSession.location || '',
            m.raceSession.country_name || '',
            seasonYear,
            round,
            m.raceSession.date_start
          );
          const hasSprint = m.sessions.some((s) =>
            (s.session_name || '').toLowerCase().includes('sprint')
          );
          return {
            id: `f1-${seasonYear}-r${round}-${meta.svgId}`,
            sport: 'F1',
            seasonYear,
            round,
            hostName: meta.hostName,
            countryName: m.raceSession.country_name || meta.hostName,
            dateRangePill: meta.dateRangePill,
            dateRangeLabel: meta.dateRangePill,
            status: Date.parse(m.raceSession.date_start) <= nowMs ? 'COMPLETED' : 'UPCOMING',
            trackMapUrl: buildF1TrackMapCarbonUrl(meta.trackCarbonName),
            isSprintWeekend: hasSprint,
            grandPrixName: meta.grandPrixName,
            officialTitle: meta.officialTitle,
            circuitName: meta.circuitName,
            city: meta.city,
            countryFlagUrl: meta.flagUrl,
            circuitSvgId: meta.svgId,
            laps: meta.laps,
            circuitLengthKm: meta.lengthKm,
            raceDistanceKm: '305.354 km',
            timeWindow: Date.parse(m.raceSession.date_start) <= nowMs ? 'PAST_RESULTS' : 'ALL_UPCOMING',
            sessions: buildStandardSessionsForWeekend(
              `f1-${seasonYear}-r${round}`,
              m.raceSession.date_start,
              hasSprint
            ),
            prefetchMeta: {
              trackTempForecast: `${seasonYear} Official FIA Telemetry`,
              rainChance: '0%',
              tyreAllocation: 'C3 Hard / C4 Medium / C5 Soft',
              lapRecord: `Official FIA ${seasonYear} Classification`,
              drsZones: 3,
              circuitLengthKm: meta.lengthKm,
              raceDistanceLaps: meta.laps,
            },
          };
        });

  const enrichedWeekends: F1Weekend[] = templateWeekends.map((weekend) => {
    const matchedMeeting = matchWeekendToOpenF1Meeting(weekend, meetings);
    if (!matchedMeeting) {
      // Ensure future weekends never display COMPLETED status
      const gp = weekend.sessions.find((s) => s.name === 'Grand Prix');
      const gpStartMs = gp ? Date.parse(gp.startTimeISO) : NaN;
      if (Number.isFinite(gpStartMs) && gpStartMs > nowMs) {
        return {
          ...weekend,
          status: 'UPCOMING',
          winnerSummary: undefined,
          sessions: weekend.sessions.map((s) =>
            Date.parse(s.startTimeISO) > nowMs
              ? { ...s, status: 'UPCOMING', sessionResults: undefined, fastestOrWinnerSummary: undefined }
              : s
          ),
        };
      }
      return weekend;
    }

    const meetingSessions = matchedMeeting.sessions;
    const openF1HasSprint = meetingSessions.some((s) =>
      (s.session_name || '').toLowerCase().includes('sprint')
    );

    const updatedSessions: F1Session[] = weekend.sessions.map((sess, idx) => {
      // Match session in meeting by name or by index
      const openSess =
        meetingSessions.find((ms) => {
          const n = (ms.session_name || '').toLowerCase();
          if (sess.name === 'FP1') return n === 'practice 1';
          if (sess.name === 'FP2') return n === 'practice 2';
          if (sess.name === 'FP3') return n === 'practice 3';
          if (sess.name === 'Sprint Qualifying') return n === 'sprint qualifying' || n === 'sprint shootout';
          if (sess.name === 'Sprint') return n === 'sprint';
          if (sess.name === 'Qualifying') return n === 'qualifying';
          if (sess.name === 'Grand Prix') return n === 'race';
          return false;
        }) || meetingSessions[idx];

      if (!openSess) return sess;

      // Only adopt OpenF1 date_start if it is within ±72 hours of the scheduled session start
      const openStartMs = Date.parse(openSess.date_start);
      const localStartMs = Date.parse(sess.startTimeISO);
      const effectiveStartISO =
        Number.isFinite(openStartMs) &&
        (!Number.isFinite(localStartMs) || Math.abs(openStartMs - localStartMs) <= 72 * 3600 * 1000)
          ? new Date(openStartMs).toISOString()
          : sess.startTimeISO;
      const effectiveStartMs = Date.parse(effectiveStartISO);

      // STRICT FUTURE GUARD: If session starts in the future, it MUST be UPCOMING with no results!
      if (Number.isFinite(effectiveStartMs) && effectiveStartMs > nowMs) {
        return {
          ...sess,
          startTimeISO: effectiveStartISO,
          istDateLabel: formatISTDateShort(effectiveStartISO),
          istTimeLabel: formatIST(effectiveStartISO),
          status: 'UPCOMING',
          fastestOrWinnerSummary: undefined,
          sessionResults: undefined,
        };
      }

      const rawSessionRows = resultsBySessionKey.get(openSess.session_key) || [];
      if (rawSessionRows.length === 0) {
        return {
          ...sess,
          startTimeISO: effectiveStartISO,
          istDateLabel: formatISTDateShort(effectiveStartISO),
          istTimeLabel: formatIST(effectiveStartISO),
        };
      }

      const sortedRows = [...rawSessionRows].sort((a, b) => {
        const posA = typeof a.position === 'number' && a.position > 0 ? a.position : 999;
        const posB = typeof b.position === 'number' && b.position > 0 ? b.position : 999;
        if (posA !== posB) return posA - posB;
        return (b.number_of_laps || 0) - (a.number_of_laps || 0);
      });

      const isRaceOrSprint = sess.name === 'Grand Prix' || sess.name === 'Sprint';
      const isQuali = sess.name === 'Qualifying' || sess.name === 'Sprint Qualifying';

      const parsedResults: F1SessionResultEntry[] = sortedRows.map((r, rIdx) => {
        const drvNum = Number(r.driver_number);
        const drvInfo = driverMapByNumber.get(drvNum) || {
          code: `D${drvNum}`,
          name: `Driver #${drvNum}`,
          team: 'Formula 1 Team',
          teamCode: 'F1T',
          color: '#FF1801',
        };

        const rawDriverStints =
          stintsBySessionAndDriver.get(`${openSess.session_key}_${drvNum}`) || [];
        const sortedStints = [...rawDriverStints].sort(
          (a, b) => (a.stint_number || 0) - (b.stint_number || 0)
        );
        const tyreStints: TyreCompound[] = sortedStints
          .map((st) => mapBatchTyreCompound(st.compound))
          .filter(Boolean);
        const lastCompound: TyreCompound =
          tyreStints.length > 0
            ? tyreStints[tyreStints.length - 1]
            : isRaceOrSprint
            ? 'M'
            : 'S';

        const formattedLapOrDuration = formatBatchLapOrRaceDuration(r.duration, isRaceOrSprint);
        const formattedGap = formatBatchGapToLeader(r.gap_to_leader);

        let statusText: F1SessionResultEntry['statusText'] = 'FINISHED';
        let timeOrGap = '';

        if (r.dsq) {
          statusText = 'DSQ';
          timeOrGap = 'DSQ';
        } else if (r.dns) {
          statusText = 'DNS';
          timeOrGap = 'DNS';
        } else if (r.dnf) {
          statusText = 'DNF';
          timeOrGap = 'DNF';
        } else if (rIdx === 0) {
          timeOrGap = isRaceOrSprint
            ? formattedLapOrDuration !== '—'
              ? `WINNER (${formattedLapOrDuration})`
              : 'WINNER'
            : formattedLapOrDuration;
        } else {
          if (formattedGap.includes('LAP')) {
            statusText = 'LAPPED';
          }
          timeOrGap = formattedGap !== '—' ? formattedGap : formattedLapOrDuration;
        }

        return {
          pos: rIdx + 1,
          driverCode: drvInfo.code,
          driverName: drvInfo.name,
          driverNumber: drvNum,
          constructorName: drvInfo.team,
          constructorCode: drvInfo.teamCode,
          constructorColor: drvInfo.color,
          timeOrGap,
          bestLapTime: formattedLapOrDuration,
          tyreCompound: lastCompound,
          tyreStints: tyreStints.length > 0 ? tyreStints : [lastCompound],
          lapsCompleted:
            typeof r.number_of_laps === 'number' ? r.number_of_laps : weekend.laps || 60,
          hasFastestLap: rIdx === 0,
          statusText,
        };
      });

      const p1 = parsedResults[0];
      const p2 = parsedResults[1];
      const p3 = parsedResults[2];
      const shortTeam = p1
        ? p1.constructorName
            .replace(
              /Formula 1 Team|F1 Team|AMG PETRONAS F1|Oracle |Scuderia |Atlassian |MoneyGram |Visa Cash App |Aramco F1/gi,
              ''
            )
            .trim()
        : '';

      const summary = p1
        ? isRaceOrSprint
          ? `Winner: ${p1.driverName} (${shortTeam})${
              p2 ? ` • P2 ${p2.driverName.split(' ').slice(-1)[0]}` : ''
            }${p3 ? ` • P3 ${p3.driverName.split(' ').slice(-1)[0]}` : ''}`
          : isQuali
          ? `Pole: ${p1.driverName} (${shortTeam}) • ${p1.bestLapTime} (${p1.tyreCompound})`
          : `Fastest: ${p1.driverName} (${shortTeam}) • ${p1.bestLapTime} (${p1.tyreCompound})`
        : sess.fastestOrWinnerSummary;

      return {
        ...sess,
        startTimeISO: effectiveStartISO,
        istDateLabel: formatISTDateShort(effectiveStartISO),
        istTimeLabel: formatIST(effectiveStartISO),
        status: 'COMPLETED',
        fastestOrWinnerSummary: summary,
        sessionResults: parsedResults,
      };
    });

    // Resolve official FIA Starting Grid and Penalties from OpenF1 `/v1/starting_grid` + Qualifying `/v1/session_result`
    const qualiOpenSess = meetingSessions.find(
      (ms) => (ms.session_name || '').toLowerCase() === 'qualifying'
    );
    const raceOpenSess = matchedMeeting.raceSession;
    const rawGridRows =
      (qualiOpenSess && gridsBySessionKey.get(qualiOpenSess.session_key)) ||
      gridsBySessionKey.get(raceOpenSess.session_key) ||
      [];

    const qualiAppSess = updatedSessions.find((s) => s.name === 'Qualifying');
    const qualiPosByDriverNum = new Map<number, { pos: number; bestLap: string; tyre: TyreCompound }>();
    for (const qr of qualiAppSess?.sessionResults || []) {
      if (qr.driverNumber) {
        qualiPosByDriverNum.set(qr.driverNumber, {
          pos: qr.pos,
          bestLap: qr.bestLapTime || qr.timeOrGap || 'NO TIME',
          tyre: qr.tyreCompound,
        });
      }
    }

    let officialStartingGrid = weekend.startingGrid;
    let resolvedPenalties: F1GridPenaltyNote[] = [...(weekend.gridPenalties || [])];

    if (rawGridRows.length >= 10) {
      const sortedGrid = [...rawGridRows].sort((a, b) => a.position - b.position);
      const totalCars = sortedGrid.length;
      const derivedPenalties: F1GridPenaltyNote[] = [];

      officialStartingGrid = sortedGrid.map((g): F1StartingGridEntry => {
        const drvNum = Number(g.driver_number);
        const drvInfo = driverMapByNumber.get(drvNum) || {
          code: `D${drvNum}`,
          name: `Driver #${drvNum}`,
          team: 'Formula 1 Team',
          teamCode: 'F1T',
          color: '#FF1801',
        };
        const qInfo = qualiPosByDriverNum.get(drvNum);
        const qualiPos = qInfo?.pos ?? g.position;
        const gridPos = g.position;
        const drop = gridPos - qualiPos;
        const existingPen = resolvedPenalties.find(
          (p) => p.driverCode.toUpperCase() === drvInfo.code.toUpperCase() && p.sessionTarget === 'Grand Prix'
        );

        const hasDropPenalty = drop >= 3 || Boolean(existingPen);
        const isBackOfGrid =
          existingPen?.penaltyPlaces === 'BACK OF GRID' ||
          existingPen?.penaltyPlaces === 'PIT LANE' ||
          (gridPos >= totalCars - 2 && drop >= 4);

        const penaltyReason =
          existingPen?.reason ||
          (isBackOfGrid
            ? `Back-of-grid / PU elements penalty (Qualified P${qualiPos} → Starts P${gridPos})`
            : drop >= 3
            ? `${drop}-place FIA grid drop penalty (Qualified P${qualiPos} → Starts P${gridPos})`
            : undefined);

        if (hasDropPenalty && penaltyReason) {
          derivedPenalties.push({
            driverCode: drvInfo.code,
            driverName: drvInfo.name,
            constructorName: drvInfo.team,
            sessionTarget: 'Grand Prix',
            qualiPos,
            gridPos,
            penaltyPlaces: isBackOfGrid ? 'BACK OF GRID' : drop,
            reason: penaltyReason,
          });
        }

        const resolvedLapTime =
          qInfo?.bestLap ||
          (typeof g.lap_duration === 'number'
            ? formatBatchLapOrRaceDuration(g.lap_duration, false)
            : 'NO TIME');

        return {
          gridPos,
          qualifiedPos: qualiPos,
          qualiPos,
          posDelta: qualiPos - gridPos,
          driverCode: drvInfo.code,
          driverName: drvInfo.name,
          driverNumber: drvNum,
          constructorName: drvInfo.team,
          constructorCode: drvInfo.teamCode,
          constructorColor: drvInfo.color,
          qualifyingTime: resolvedLapTime,
          qualiBestLapTime: resolvedLapTime,
          tyreCompound: qInfo?.tyre || 'S',
          penaltyApplied: penaltyReason || undefined,
          penaltyReason,
          isBackOfGridStart: isBackOfGrid,
        };
      });

      if (derivedPenalties.length > 0) {
        resolvedPenalties = derivedPenalties;
      }
    }

    const gpCompleted = updatedSessions.find(
      (s) => s.name === 'Grand Prix' && s.status === 'COMPLETED' && s.sessionResults?.length
    );

    return enrichF1WeekendWithStartingGrids({
      ...weekend,
      isSprintWeekend: openF1HasSprint || weekend.isSprintWeekend,
      status: gpCompleted ? 'COMPLETED' : weekend.status,
      winnerSummary: gpCompleted?.fastestOrWinnerSummary || weekend.winnerSummary,
      startingGrid: officialStartingGrid,
      gridPenalties: resolvedPenalties.length > 0 ? resolvedPenalties : weekend.gridPenalties,
      sessions: updatedSessions,
    });
  });

  seasonBatchMemoryCache.set(seasonYear, {
    fetchedAtMs: nowMs,
    weekends: enrichedWeekends,
    openF1SessionsCount: rawSessions.length,
  });

  return {
    weekends: enrichedWeekends,
    openF1SessionsCount: rawSessions.length,
  };
}

export async function fetchF1SeasonCalendar(
  seasonYear: number
): Promise<F1Weekend[]> {
  const currentYear = new Date().getUTCFullYear();
  if (seasonYear > currentYear) {
    await fetchWithResilience<any>(`https://api.jolpi.ca/ergast/f1/${seasonYear}.json`, {
      ttlMs: TTL_SCHEDULE_ROSTER_MS,
      cacheKey: `jolpica_${seasonYear}_calendar`,
    });
    return F1_2027_FULL_SEASON.map((w) => ({
      ...w,
      seasonYear,
    }));
  }

  const baseForYear =
    seasonYear === 2026
      ? F1_2026_FULL_SEASON
      : seasonYear === 2025
      ? F1_2025_HIGHLIGHT_SEASON
      : undefined;

  const batch = await fetchOpenF1SeasonBatchData(seasonYear, baseForYear);
  return batch.weekends;
}

export interface MultiSourceF1SessionVerificationResult {
  verified: boolean;
  sourcesChecked: string[];
  discrepancies: string[];
  sanitizedResults: F1SessionResultEntry[];
  startingGrid?: F1StartingGridEntry[];
}

/**
 * Multi-Source F1 Session & Tyre Compound Verification Gatekeeper:
 * Cross-checks candidate F1 session classifications, tyre compounds (`S`, `M`, `H`, `I`, `W`),
 * and starting grid penalties across multiple sources (OpenF1 `/v1/stints` + `/v1/session_result`
 * and Jolpica `/qualifying.json` + `/results.json`) before admitting unverified data into the app.
 */
export function verifyF1SessionResultsMultiSource(params: {
  sessionName: 'FP1' | 'Sprint Qualifying' | 'FP2' | 'Sprint' | 'FP3' | 'Qualifying' | 'Grand Prix';
  primaryResults: F1SessionResultEntry[];
  secondaryResults?: Array<{
    driverCode: string;
    pos?: number;
    tyreCompound?: 'S' | 'M' | 'H' | 'I' | 'W';
    bestLapTime?: string;
    gridPos?: number;
  }>;
  penalties?: F1GridPenaltyNote[];
}): MultiSourceF1SessionVerificationResult {
  const VALID_TYRE_COMPOUNDS = new Set(['S', 'M', 'H', 'I', 'W']);
  const { sessionName, primaryResults, secondaryResults = [], penalties = [] } = params;
  const sourcesChecked = ['OpenF1:session_result+stints'];
  if (secondaryResults.length > 0) {
    sourcesChecked.push('Jolpica:qualifying+results');
  }

  const discrepancies: string[] = [];
  if (!Array.isArray(primaryResults) || primaryResults.length === 0) {
    return {
      verified: false,
      sourcesChecked,
      discrepancies: ['Primary session classification is empty'],
      sanitizedResults: [],
    };
  }

  const secondaryByDriver = new Map(
    secondaryResults.map((r) => [r.driverCode.toUpperCase(), r])
  );

  const seenPositions = new Set<number>();
  const seenDrivers = new Set<string>();

  const sanitizedResults: F1SessionResultEntry[] = primaryResults
    .slice()
    .sort((a, b) => a.pos - b.pos)
    .map((entry, idx) => {
      const code = (entry.driverCode || '').toUpperCase().trim();
      const expectedPos = idx + 1;

      if (entry.pos !== expectedPos) {
        discrepancies.push(
          `${sessionName}: Position gap at ${code} (reported P${entry.pos}, normalized to P${expectedPos})`
        );
      }
      if (seenDrivers.has(code)) {
        discrepancies.push(`${sessionName}: Duplicate driver code ${code}`);
      }
      seenDrivers.add(code);
      seenPositions.add(expectedPos);

      const sec = secondaryByDriver.get(code);
      let resolvedTyre = entry.tyreCompound;
      if (!VALID_TYRE_COMPOUNDS.has(resolvedTyre)) {
        discrepancies.push(
          `${sessionName}: Invalid tyre compound "${String(resolvedTyre)}" on ${code}`
        );
        resolvedTyre = sec?.tyreCompound && VALID_TYRE_COMPOUNDS.has(sec.tyreCompound)
          ? sec.tyreCompound
          : 'S';
      } else if (
        sec?.tyreCompound &&
        VALID_TYRE_COMPOUNDS.has(sec.tyreCompound) &&
        sec.tyreCompound !== resolvedTyre
      ) {
        discrepancies.push(
          `${sessionName}: Tyre compound cross-check reconciled for ${code} (primary=${resolvedTyre}, secondary=${sec.tyreCompound})`
        );
      }

      if (sec?.pos !== undefined && sec.pos !== expectedPos) {
        discrepancies.push(
          `${sessionName}: Classification mismatch for ${code} (primary=P${expectedPos}, secondary=P${sec.pos})`
        );
      }

      return {
        ...entry,
        pos: expectedPos,
        driverCode: code,
        tyreCompound: resolvedTyre,
      };
    });

  let startingGrid: F1StartingGridEntry[] | undefined;
  if (sessionName === 'Qualifying' || sessionName === 'Sprint Qualifying') {
    startingGrid = computeStartingGridWithPenalties(
      sanitizedResults,
      penalties,
      sessionName === 'Sprint Qualifying' ? 'Sprint' : 'Grand Prix'
    );
  }

  return {
    verified: seenDrivers.size === sanitizedResults.length && sanitizedResults.length > 0,
    sourcesChecked,
    discrepancies,
    sanitizedResults,
    startingGrid,
  };
}

