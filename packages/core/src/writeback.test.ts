import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('@orionx/db',()=>({prisma:{sourceObservation:{findFirst:vi.fn()},sourceSync:{findUnique:vi.fn(),update:vi.fn()},version:{findFirst:vi.fn()}}}));
vi.mock('./sheets',async()=>{const actual=await vi.importActual<typeof import('./sheets')>('./sheets');return {...actual,sheetsClient:vi.fn()}});
import {prisma} from '@orionx/db';
import {sheetsClient,inputFingerprint} from './sheets';
import {fixtureRows,fixtureValues} from './fixtures';
import {writeBack} from './writeback';
const source=fixtureRows()[0],live=fixtureValues()[4];
const update={recordId:source.award.recordId,version:1,status:'SYNCED' as const,timestamp:'2026-10-24T12:00:00.000Z',expectedFingerprint:inputFingerprint(source),passportId:source.student.passportId,initialIssueDate:source.student.initialIssueDate};
let read:ReturnType<typeof vi.fn>,write:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.stubEnv('SOURCE_MODE','sheets');vi.clearAllMocks();
 vi.mocked(prisma.sourceObservation.findFirst).mockResolvedValue({payload:source} as never);
 vi.mocked(prisma.sourceSync.findUnique).mockResolvedValue({syncedVersion:null} as never);
 vi.mocked(prisma.version.findFirst).mockResolvedValue({chainCluster:'devnet',finalizedSlot:1n} as never);
 read=vi.fn().mockResolvedValueOnce({data:{valueRanges:[{valueRange:{values:[live]}}]}}).mockResolvedValueOnce({data:{valueRanges:[{valueRange:{values:[[...live.slice(0,16),'SYNCED','V1',update.timestamp,'']]}}]}});
 write=vi.fn().mockResolvedValue({});
 vi.mocked(sheetsClient).mockResolvedValue({sheetId:'test',tab:'Passport Skill Records',sheets:{spreadsheets:{developerMetadata:{search:vi.fn().mockResolvedValue({data:{matchedDeveloperMetadata:[{developerMetadata:{metadataId:42}}]}})},values:{batchGetByDataFilter:read,batchUpdateByDataFilter:write}}}} as never);
});
afterEach(()=>vi.unstubAllEnvs());
describe('retry-safe Sheets success writeback',()=>{
 it('addresses stable row metadata and writes only Q-T using V-prefixed versions',async()=>{
  await writeBack([source],[update]);const payload=write.mock.calls[0][0].requestBody.data[0];expect(payload.dataFilter.developerMetadataLookup.metadataId).toBe(42);expect(payload.values[0].slice(0,16)).toEqual(Array(16).fill(null));expect(payload.values[0].slice(16)).toEqual(['SYNCED','V1',update.timestamp,'']);
 });
 it('refuses success without real finalized Devnet evidence',async()=>{
  vi.mocked(prisma.version.findFirst).mockResolvedValue(null);await expect(writeBack([source],[update])).rejects.toThrow('finalized Devnet');expect(write).not.toHaveBeenCalled();
 });
 it('blocks a source mutation before touching the sheet',async()=>{
  const changed=structuredClone(source);changed.award.dateEarned='2026-01-01';await expect(writeBack([changed],[update])).rejects.toThrow('Source changed');expect(write).not.toHaveBeenCalled();
 });
 it('detects metadata resolving to another record before writing',async()=>{
  const moved=[...live];moved[9]='REC-SOMEONE-ELSE';read.mockReset().mockResolvedValue({data:{valueRanges:[{valueRange:{values:[moved]}}]}});await expect(writeBack([source],[update])).rejects.toThrow('Source binding changed');expect(write).not.toHaveBeenCalled();
 });
});
