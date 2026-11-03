import {expect,it,vi} from 'vitest';
import {ClockView} from './ClockView';
it('adjudicates a restored expired clock synchronously before starting a timer',()=>{
 const view=new ClockView({innerHTML:''} as HTMLElement,3);const timeout=vi.fn();view.onTimeOut(timeout);
 view.restore({white:0,black:100});view.start('w');expect(timeout).toHaveBeenCalledWith('w');view.destroy();
});
it('does not adjudicate zero in an untimed game',()=>{
 const view=new ClockView({innerHTML:''} as HTMLElement,0);const timeout=vi.fn();view.onTimeOut(timeout);
 view.start('w');expect(view.expired('w')).toBe(false);expect(timeout).not.toHaveBeenCalled();view.destroy();
});
