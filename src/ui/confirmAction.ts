/** Accessible in-app confirmation; avoids blocking browser dialogs on iOS. */
export async function confirmAction(message:string):Promise<boolean> {
  if(typeof document==='undefined') return typeof confirm==='function' ? confirm(message) : false;
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='confirm-dialog';
    const title=document.createElement('h2');title.textContent=message;title.id='confirmation-title';
    const body=document.createElement('p');body.textContent='Confira antes de continuar. Esta ação não pode ser desfeita.';
    const actions=document.createElement('div');actions.className='confirmation-actions';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='btn btn-secondary';cancel.textContent='Cancelar';
    const proceed=document.createElement('button');proceed.type='button';proceed.className='btn btn-danger';proceed.textContent='Confirmar';
    const finish=(result:boolean)=>{dialog.close();dialog.remove();resolve(result);};
    cancel.addEventListener('click',()=>finish(false));proceed.addEventListener('click',()=>finish(true));
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
    actions.append(cancel,proceed);dialog.append(title,body,actions);dialog.setAttribute('aria-labelledby',title.id);
    document.body.appendChild(dialog);dialog.showModal();cancel.focus();
  });
}
