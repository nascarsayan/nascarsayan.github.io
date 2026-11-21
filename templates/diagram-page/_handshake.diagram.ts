/** Example sequence: participants, messages (ids m1, m2, ...) and frames. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'user', label: 'Browser' },
    { id: 'app', label: 'App server', tone: 'primary' },
    { id: 'idp', label: 'Identity provider', tone: 'teal' },
  ],
  messages: [
    { from: 'user', to: 'app', label: 'GET /account' },
    { from: 'app', to: 'user', label: '302 to identity provider', style: 'dashed' },
    { from: 'user', to: 'idp', label: 'sign in' },
    { from: 'idp', to: 'user', label: 'code', style: 'dashed' },
    { from: 'user', to: 'app', label: 'callback with code' },
    { from: 'app', to: 'idp', label: 'exchange code', info: 'Server to server: the browser never sees the token.' },
    { from: 'app', to: 'user', label: '200 account page', tone: 'good' },
  ],
  frames: [
    { label: 'Redirect', from: 'm1', to: 'm4', tone: 'muted' },
    { label: 'Callback', from: 'm5', to: 'm7', tone: 'primary' },
  ],
});
