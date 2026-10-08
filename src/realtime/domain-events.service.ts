import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class DomainEventsService {
  private readonly emitter = new EventEmitter();

  emit<T>(eventName: string, payload: T): void {
    this.emitter.emit(eventName, payload);
  }

  on<T>(eventName: string, listener: (payload: T) => void): void {
    this.emitter.on(eventName, listener);
  }
}
