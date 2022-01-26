'use strict';

import { NativeModules } from 'react-native';
import base64 from 'base64-js';
import EventTarget from 'event-target-shim';
import MessageEvent from './MessageEvent';
import RTCDataChannelEvent from './RTCDataChannelEvent';
import EventEmitter from './EventEmitter';

const {WebRTCModule} = NativeModules;

type RTCDataChannelState =
  'connecting' |
  'open' |
  'closing' |
  'closed';

const DATA_CHANNEL_EVENTS = [
  'open',
  'message',
  'bufferedamountlow',
  'closing',
  'close',
  'error',
];

export default class RTCDataChannel extends EventTarget(DATA_CHANNEL_EVENTS) {
  _peerConnectionId: number;
  _reactTag: string;

  _id: number;
  _label: string;
  _maxPacketLifeTime: ?number;
  _maxRetransmits: ?number;
  _negotiated: boolean;
  _ordered: boolean;
  _protocol: string;
  _readyState: RTCDataChannelState;

  binaryType: 'arraybuffer' = 'arraybuffer'; // we only support 'arraybuffer'
  bufferedAmount: number = 0;
  bufferedAmountLowThreshold: number = 0;

  onopen: ?Function;
  onmessage: ?Function;
  onbufferedamountlow: ?Function;
  onerror: ?Function;
  onclose: ?Function;

  constructor(info) {
    super();

    this._peerConnectionId = info.peerConnectionId;
    this._reactTag = info.reactTag;

    this._label = info.label;
    this._id = info.id === -1 ? null : info.id; // null until negotiated.
    this._ordered = Boolean(info.ordered);
    this._maxPacketLifeTime = info.maxPacketLifeTime;
    this._maxRetransmits = info.maxRetransmits;
    this._protocol = info.protocol || '';
    this._negotiated = Boolean(info.negotiated);
    this._readyState = info.readyState;

    this._registerEvents();
  }

  get label(): string {
    return this._label;
  }

  get id(): number {
    return this._id;
  }

  get ordered(): boolean {
    return this._ordered;
  }

  get maxPacketLifeTime(): number {
    return this._maxPacketLifeTime;
  }

  get maxRetransmits(): number {
    return this._maxRetransmits;
  }

  get protocol(): string {
    return this._protocol;
  }

  get negotiated(): boolean {
    return this._negotiated;
  }

  get readyState(): string {
    return this._readyState;
  }

  send(filepath, position, length) {
    WebRTCModule.dataChannelSend(
      this._peerConnectionId, 
      this._reactTag, 
      filepath, 
      position,
      length
      );
  }

  close() {
    if (this._readyState === 'closing' || this._readyState === 'closed') {
      return;
    }
    WebRTCModule.dataChannelClose(this._peerConnectionId, this._reactTag);
  }

  _unregisterEvents() {
    this._subscriptions.forEach(e => e.remove());
    this._subscriptions = [];
  }

  _registerEvents() {
    this._subscriptions = [
      EventEmitter.addListener('dataChannelStateChanged', ev => {
        if (ev.reactTag !== this._reactTag) {
          return;
        }
        this._readyState = ev.state;
        if (this._id === null && ev.id !== -1) {
          this._id = ev.id;
        }
        if (this._readyState === 'open') {
          this.dispatchEvent(new RTCDataChannelEvent('open', {channel: this}));
        } else if (this._readyState === 'closing') {
          this.dispatchEvent(new RTCDataChannelEvent('closing', {channel: this}));
        } else if (this._readyState === 'closed') {
          this.dispatchEvent(new RTCDataChannelEvent('close', {channel: this}));
          this._unregisterEvents();
          WebRTCModule.dataChannelDispose(this._peerConnectionId, this._reactTag);
        }
      }),

      EventEmitter.addListener('onBufferedAmountChange', ev=> {
        this.bufferedAmount = ev.amount;
      }),
      EventEmitter.addListener('dataChannelReceiveMessage', ev => {
        if (ev.reactTag !== this._reactTag) {
          return;
        }
        let data = ev.data;
        this.dispatchEvent(new MessageEvent('message', {data}));
      }),
    ];
  }
}
