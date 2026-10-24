import type {Snapshot} from './index';
import {demoTemplate} from './pdf';
import {btuTemplate} from './pdf-btu';
export const templates=new Map([demoTemplate,btuTemplate].map(t=>[t.revision,t]));
export function renderPassportPdf(snapshot:Snapshot){const adapter=templates.get(snapshot.templateRevision);if(!adapter)throw Error('Unrecognized frozen template revision');return adapter.render(snapshot)}
