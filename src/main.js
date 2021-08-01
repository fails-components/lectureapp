/*
    Fails Components (Fancy Automated Internet Lecture System - Components)
    Copyright (C)  2015-2017 (original FAILS), 
                   2021- (FAILS Components)  Marten Richter <marten.richter@freenet.de>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import React, { Component } from 'react'
import { Dialog } from 'primereact/dialog';
import {Checkbox} from 'primereact/checkbox';
import { Button } from 'primereact/button';
import { Galleria } from 'primereact/galleria';
import { Menu } from 'primereact/menu';
import { Sidebar } from 'primereact/sidebar';
import { InputText } from 'primereact/inputtext';
import { OverlayPanel } from 'primereact/overlaypanel';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { confirmPopup } from 'primereact/confirmpopup';
import {Steps} from 'primereact/steps';
import { ListBox } from 'primereact/listbox';
import { Chart } from 'primereact/chart';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import screenfull from "screenfull"
import {NoteScreenBase} from './notepad.js'
import { io } from "socket.io-client";
import jwt_decode from "jwt-decode";
import katex from "katex";
import 'katex/dist/katex.min.css';
import { v4 as uuidv4 } from 'uuid';
import {FailsConfig} from '@martenrichter/fails-components-config';

let cfg=new FailsConfig({react: true});

class ChannelEdit extends Component {
  constructor(props) {
    super(props);
    this.availscreensmenu=React.createRef();
  }
  render() { // ok this is easy, we get two properties availscreens for selection, and channelinfo for the channels

    let availscreensitems=[ { label: 'Move/add to end',
        items: this.props.availscreens.map((el,ind)=> { 
          let purpose="Unknown";
          if (el.purpose==="notepad") purpose="Notepad";
          else if (el.purpose==="screen") purpose="Screen";
          console.log("channel uuid",el.channel,el.uuid);
          return {label:  (ind+1)+". "+ purpose, command: () => (this.props.app.addNotescreenToChannel(this.selchannel,el.uuid))   } ;   
      })
     },{label: "New...",items: [
       {
         label: " Notepad",
         command: ()=>(this.props.app.onOpenNewNotepad())
       },
       {
        label: " Screen",
        command: ()=>(this.props.app.onOpenNewScreen())
      },
      {
        label: " Writing",
        command: ()=>(this.props.app.onNewWriting())
      },
     ]

     }];  
     
       /* <Button label="Open new screen" onClick={this.onOpenNewScreen} />
        
        {(this.state.availscreens.length>0) &&
        <div className="p-col-4">
        
        <Button label="Add screen" onClick={(event) => this.availscreensmenu.current.toggle(event)} aria-controls="availscreen_menu" aria-haspopup />
        </div>}
        {((!this.state.noscreen) && this.state.selscreen) && <div className="p-col-4">
        <Button label="Remove screen" onClick={this.onRemoveScreen} />
        </div>}*/

    if (!this.props.channelinfo) return <React.Fragment>Waiting for data...</React.Fragment>;
    let channels= this.props.channelinfo.map((el,ind)=>{
      let type="Unknown";
      if (el.type==="notebooks") type="Writing";
      let notescreens=el.notescreens.map((el2)=>{
        let index=this.props.availscreens.findIndex((el3)=>(el3.uuid===el2.uuid));
        let purpose="Unknown";
        if (el2.purpose==="notepad") purpose="Notepad";
        else if (el2.purpose==="screen") purpose="Screen";
        
        return <div className="p-m-2 p-shadow-1 p-p-2"> {(index+1)+". "+purpose} </div>

      })
      console.log("notescreen", el);
      console.log("avail screens", this.props.availscreens);

      

      return <div className="p-mr-2 p-shadow-1">
        <div className="p-d-flex p-flex-column p-jc-center">
        <div className="p-m-2 p-p-1"><h3><Button icon="pi pi-bars" className="p-button-rounded p-button-text p-button-sm" iconPos="right"
         onClick={(event) =>{this.selchannel=el.channeluuid; this.availscreensmenu.current.toggle(event);}} aria-controls="availscreen_menu" aria-haspopup ></Button>
         {(ind+1)+". "+type} 
         {(ind!==0 && el.notescreens.length===0) && <Button icon="pi pi-trash" className="p-button-rounded p-button-text p-button-sm" onClick={()=>(this.props.app.onRemoveChannel(el.channeluuid))}></Button>}
         
          </h3></div>
        {notescreens}
        <div className="p-m-2 p-p-1">
        </div>
        </div>
      </div>
    });

    return <div className="p-d-flex"> 
    <Menu model={availscreensitems} popup ref={this.availscreensmenu} id="availscreen_menu" />
    {channels}
    </div>

  }
}

export class FailsBasis extends Component
{
  constructor(props)
  {
    super(props);
    this.myauthtoken=sessionStorage.getItem('failstoken');
    this.noteref=null;
    this.getNoteRef=this.getNoteRef.bind(this);
    this.updateSizes=this.updateSizes.bind(this);
    this.requestReauthor=this.requestReauthor.bind(this);
    this.getToken=this.getToken.bind(this);
    this.authCB=this.authCB.bind(this);
    this.reauthorizeTimeout=null;
  }

  netSendSocket(command,data)
  {
    if (this.socket) this.socket.emit(command,data);
  }

  initializeCommonSocket(commonsocket)
  {
    commonsocket.removeAllListeners('authtoken');
    commonsocket.on('authtoken',function(data) {
        console.log("authtoken renewed",data);
        console.log("oldauthtoken", this.myauthtoken);
        this.myauthtoken=data.token;
        sessionStorage.setItem('failstoken',data.token);
        console.log("newauthtoken", this.myauthtoken);
        this.scheduleReauthor(); // request renewal
    }.bind(this));

    commonsocket.removeAllListeners('reloadBoard');
    commonsocket.on('reloadBoard',function(data) {
      console.log("reloadboard",data, this.noteref);
      if (this.noteref) {
    
        this.noteref.replaceData(data);
        if (data.last) this.noteref.setHasControl(true);
      }
    }.bind(this));

    commonsocket.removeAllListeners('availscreens');
    commonsocket.on('availscreens',function(data) {
        // we can also figure out a notescreen id
        console.log("availscreens",data);
        if (data.screens){
          let notescreenuuid=this.decoded_token().notescreenuuid;
          
          let nsid=data.screens.findIndex( (el)=>(el.uuid===notescreenuuid));

          this.setState({availscreens: data.screens, notescreenid: nsid});
          console.log("nsid",nsid);
        }
        
    }.bind(this));

    commonsocket.on('channelinfo', (data)=>{
      console.log("data channelinfo",data);
      let setstate={};
      let notescreenuuid=this.decoded_token().notescreenuuid;
  // #error TODO assure that notepads are always within positive range and make sure that changes are immediately  
      setstate.casttoscreens=data.casttoscreens==="true";
      setstate.blackbackground=data.backgroundbw==="true";
      setstate.showscreennumber=data.showscreennumber==="true";
      if (data.channelinfo) {
        setstate.channelinfo=data.channelinfo;
        let channel=data.channelinfo.find( (el)=>(
          (el.notescreens.findIndex((el2)=>(el2.uuid===notescreenuuid))!==-1) ? true: false));
        let scrolloffset=0;
        if (channel) {
          let notepos=0;
          let curpos=0;
          for (let i=0;i< channel.notescreens.length; i++) {
            let cur=channel.notescreens[i];
            curpos += parseFloat(cur.scrollheight);
            if (cur.purpose==="notepad") notepos=curpos;
          }
          if (notepos===0) notepos=curpos; // if there is no notepad, then treat the lonely screen(s), all as a notepad
          for (let i=0; i< channel.notescreens.length; i++) {
            let cur=channel.notescreens[i];
            console.log("scrolloffsets",cur.scrollheight,cur.uuid);
            
            
            scrolloffset -= parseFloat(cur.scrollheight);
            if (cur.uuid === notescreenuuid) break;
            
          }
          scrolloffset+=notepos;
          console.log("Final screen scrolloffset",scrolloffset,this.noteref);
          if (this.noteref) this.noteref.setScrollOffset(scrolloffset);
        }
      }
      console.log("monitor setstate",setstate,data);
      this.setState(setstate);

/*
      var scrolloffset = 0.;
      console.log("data notepad",data.notepadisscreen,data );
      if (data.notepadisscreen=="true") { //if notepad is a screen all additional screen start in negative area
        // if it is not a screen we have to correct the offset
        scrolloffset =  -parseFloat(data.notepadscrollheight);
      }
      //now we have to add all screenheight up to the current one
      var arr = data.screenheights;
      console.log("data notepad arr",arr);
      if (arr) {
        var length = arr.length;
        var i = 0;
        for (i = 0; i < length; i++) {
          if (!arr[i]) continue;
          var cur = arr[i];
          console.log("calccheck",cur.scrollheight,parseFloat(cur.scrollheight),cur,scrolloffset);
          
          if (cur.uuid == this.decoded_token().screenuuid) {
            break;
          }
          //console.log("screenif",this.decoded_token().screenuuid,cur.uuid );
          scrolloffset -= parseFloat(cur.scrollheight);
        }
        console.log("Final screen scrolloffset",scrolloffset,this.noteref);
        if (this.noteref) this.noteref.setScrollOffset(scrolloffset);
      }
      this.setState({casttoscreens: data.casttoscreens=="true", 
              blackbackground: data.backgroundbw=="true"  }*/



    });

    commonsocket.removeAllListeners('drawcommand');
    commonsocket.on('drawcommand',function(data) {
          //console.log("drawcommand commoncocket",data );
          //console.log("noteref",this.noteref);
          if (this.noteref) this.noteref.receiveData(data);
    }.bind(this));

    commonsocket.removeAllListeners('pictureinfo');
    commonsocket.on('pictureinfo',function(data) {
        if (this.noteref) {
          data.forEach((el)=> {
              this.noteref.receivePictInfo({uuid: el.sha, url: el.url, mimetype: el.mimetype});
          });
        }
    }.bind(this));

    commonsocket.removeAllListeners('bgpdfinfo');
    commonsocket.on('bgpdfinfo',function(data) {
       console.log("bgpdfinfo commonsocket", data);
       if (data.bgpdfurl) {
         this.updateSizes({blackbackground: false});
         this.setState({bgpdf: true});
       }
       if (data.none) this.setState({bgpdf: false});
        if (this.noteref) {
              this.noteref.receiveBgpdfInfo({url: data.bgpdfurl, none: !!data.none});
        }
    }.bind(this));
   

    

    commonsocket.removeAllListeners('FoG');
    commonsocket.on('FoG',function(data) {
        if (this.noteref) this.noteref.receiveFoG(data);
    }.bind(this));

    commonsocket.removeAllListeners('error');
    commonsocket.on('error',function(data) {
        console.log("Socketio error",data);
        this.servererrorhandler ( data.code, data.message,  data.type );
        if (commonsocket) commonsocket.disconnect();
        
    }.bind(this));

    commonsocket.on('unauthorized', (error) => {
      console.log("unauthorized", error);
      if (error.data.type === 'UnauthorizedError' || error.data.code === 'invalid_token') {
        this.servererrorhandler ( null, "unauthorized",  null );
        // redirect user to login page perhaps?
        console.log('User token has expired');
      }
    });

    commonsocket.on("connect_error", (err) => {
      console.log("connect error", err.message); 
      this.servererrorhandler ( null, "connect error: " +err.message,  null );
    });

  }

  servererrorhandler( code, message,  type )
  {
    console.log("server error",code, message,type);
    this.toast.show({severity:'error', summary: 'Error Message', detail: message, life: 20000});
  }

  scheduleReauthor()
  {
    if (this.reauthorizeTimeout) {
      clearTimeout(this.reauthorizeTimeout);
      this.reauthorizeTime=null;
    }
    this.reauthorizeTimeout=setTimeout(this.requestReauthor, 5*60*1000); // renew every 5 Minutes, a token last 10 minutes
  }

  authCB(cb)
  {
    let token=this.getToken();
    //console.log("authCB",cb);
    cb({token: token});
  }

  decoded_token()
  {
    let curtoken=this.getToken();
   // console.log("tokens internal",curtoken,this.decoded_token_int, window.failstoken, this.lastdectoken);
    if (curtoken!==this.lastdectoken) {

      try {
      this.decoded_token_int=jwt_decode(curtoken);
      this.lastdectoken=curtoken;
    
      } catch(error) {
        console.log("curtoken",curtoken);
        console.log("token error",error);
      }
    }
    //console.log("tokens",curtoken,this.decoded_token_int);

    return this.decoded_token_int;
  }

  getToken() {
    //console.log("gettoken",this.myauthtoken);
    if (this.myauthtoken) return this.myauthtoken;

  }

  commonMount() {

  }

  commonUnmount() {
    if (this.reauthorizeTimeout) {
      clearTimeout(this.reauthorizeTimeout);
      this.reauthorizeTime=null;
    }
  }

  requestReauthor()
  {
    this.netSendSocket("reauthor",{})
  }

  getNoteRef(ref)
  {
    console.log("getNoteRef");
    this.noteref=ref;
  /*  this.noteref.setHasControl(true);
    this.noteref.reactivateToolBox();*/
  }

  updateSizes(args)
  {
    if (this.noteref) {
      console.log("checko us",this.noteref.blackboard.current);
      var data= {
          scrollheight: this.noteref.blackboard.current.scrollheight(),
          //isscreen: this.isscreen,
          backgroundbw: this.state.blackbackground,
          showscreennumber: this.state.showscreennumber
      };
      console.log("update sizes",data,args);
      if (args && args.scrollheight) data.scrollheight=args.scrollheight;
      if (args && typeof args.blackbackground!== 'undefined') data.backgroundbw=args.blackbackground;
      if (args && typeof args.showscreennumber!== 'undefined') data.showscreennumber=args.showscreennumber;
      console.log("update sizes2",data,args);
      if (!this.isscreen) {
          //data.isalsoscreen=this.state.notepadisscreen;
          data.casttoscreens=this.state.casttoscreens;
          //data.showscreennumber=this.state.showscreennumber;
          //if (args && typeof args.notepadisscreen!== 'undefined') data.isalsoscreen=args.notepadisscreen;
          if (args && typeof args.casttoscreens!== 'undefined') data.casttoscreens=args.casttoscreens;
          //if (args && typeof args.showscreennumber!== 'undefined') data.showscreennumber=args.showscreennumber;
          
      }
     

      if (this.netSendSocket) this.netSendSocket("updatesizes",data);
    }
    this.setState(args);

  };

  detectLatex(string)
  {
    return (string.indexOf("$")!==-1);
  }

  convertToLatex(string)
  {
    
    let retarray=[];
    let secstart=0;
    let seclatex=false;
    for (let curpos = 0; curpos < string.length; curpos++) {
      let curchar = string.charAt(curpos);
      if (curchar==="$") {
        if (seclatex) {
          let html=katex.renderToString(string.substring(secstart,curpos),{throwOnError: false, displayMode: false });
          retarray.push(<span dangerouslySetInnerHTML={{__html: html }}></span>);
          secstart=curpos+1;
          seclatex=false;
        } else {
          retarray.push(<React.Fragment>{string.substring(secstart,curpos-1)} </React.Fragment>);
          secstart=curpos+1;
          seclatex=true;
        }
      }
    }
    
    retarray.push(<React.Fragment>{string.substring(secstart,string.length)} </React.Fragment>);
      
    
    return retarray;
  }


}

export class FailsBoard extends FailsBasis
{
  constructor(props)
  {
    super(props);
    this.state={};
    this.state.endbuttondialog=true;
    this.state.pictbuttondialog=false;
    this.state.casttoscreens=false;
    this.state.showscreennumber=false;
    this.state.notepadisscreen=true;
    this.state.blackbackground=true;
    this.state.screens=[{name: "Loading..."}];
    this.state.noscreen=false;
    this.state.pictures=null;
    this.state.pictIndex=0;
    this.state.availscreens=[];

    

    this.availscreensmenu=React.createRef();

    this.blockchathash=[];

    //this.notepaduuid=uuidv4(); // may be get it later from server together with token?, yes that is how it is handled


    this.netSendShortCircuit=this.netSendShortCircuit.bind(this);
    this.netSendSocket=this.netSendSocket.bind(this);
    
    this.onHideMainDialog=this.onHideMainDialog.bind(this);
    this.onHidePictDialog=this.onHidePictDialog.bind(this);
    this.onAddPicture=this.onAddPicture.bind(this);
    this.onOpenNewScreen=this.onOpenNewScreen.bind(this);
    this.onNewWriting=this.onNewWriting.bind(this);
    this.endbuttonCallback=this.endbuttonCallback.bind(this);
    this.pictbuttonCallback=this.pictbuttonCallback.bind(this);
    this.itemGalleriaTemplate=this.itemGalleriaTemplate.bind(this);
    this.thumbnailGalleriaTemplate=this.thumbnailGalleriaTemplate.bind(this);
    this.pollTemplate=this.pollTemplate.bind(this);
    this.blockChat=this.blockChat.bind(this);
    this.onStartPoll=this.onStartPoll.bind(this);
    this.onStartSelPoll=this.onStartSelPoll.bind(this);
    this.onFinishSelPoll=this.onFinishSelPoll.bind(this);
    

    

  }

  netSendShortCircuit(command,data)
  {
    if (command==='lecturedetail')
    {
      this.setState({lecturedetail: data});
      return;
    }
    if (this.noteref){
      switch (command) {
      case 'drawcommand': 
        this.noteref.receiveData(data);
      break;
      case 'pictureinfo': 
        this.noteref.receivePictInfo(data);
      break;
      case 'FoG': 
        this.noteref.receiveFoG(data);
      break;
      default: 
        console.log("unhandled network command");
      
     };
    }

  }

 

  componentDidMount() 
  {
      console.log("Component mount Failsboard");
      if (this.decoded_token().notepadhandler)
      {
         this.socket=io(this.decoded_token().notepadhandler+"/notepads", {
          'auth': this.authCB/*+ sessionStorage.getItem("FailsAuthtoken")*/, 
          multiplex: false
        });
        this.initializeNotepadSocket(this.socket);
        this.updateSizes(); // no argument no effect
      }
      this.commonMount();


  }

  componentWillUnmount() 
  {
    console.log("Component unmount Failsboard");
    if (this.socket) {
      this.socket.disconnect();
      this.socket=null;
    }
    this.commonUnmount();
  }

  initializeNotepadSocket(notepadsocket)
  {
    this.initializeCommonSocket(notepadsocket);



    notepadsocket.on('notepadscreens',function(data) {
      console.log("notepadscreens",data);
      if (data.screens.length===0){
        this.setState({screens: [{ name: "No screen available", value: "none" }], noscreen: true});
      } else {
        this.setState({screens: data.screens, selscreen: null, noscreen: false });
      }
    }.bind(this));

 

    notepadsocket.removeAllListeners('connect');
    notepadsocket.on('connect', function (data) {

      if (this.noteref) this.noteref.setHasControl(false); // do not emit while reloading!
      setTimeout(function () {
        notepadsocket.emit('sendboards', {
          
        });
      }, 500);
      this.updateSizes(); // inform sizes
      this.scheduleReauthor();
    }.bind(this));

    notepadsocket.removeAllListeners('chatquestion');
    notepadsocket.on('chatquestion', function(data){
      console.log("Incoming chat",data);
      let retobj=<React.Fragment>
      <span className="p-toast-message-icon pi pi-info-circle"></span>
      <div className="p-toast-message-text">
      {data.displayname && <h3>{data.displayname+":"}</h3>}
      {this.convertToLatex(data.text)} <br></br>
      <Button  icon="pi pi-ban" className="p-button-danger p-button-outlined p-button-rounded p-m-2" onClick={(event)=>{
        confirmPopup({
          target: event.currentTarget,
          message: 'Do you want to block '+data.displayname+' from sending messages for the remaining session!',
          icon: 'pi pi-exclamation-triangle',
          accept: () => (this.blockChat(data.userhash))
      });
      }}  />
      <Button  icon="pi pi-info-circle" className="p-button-danger p-button-outlined p-button-rounded p-m-2" onClick={(event)=>{
        confirmPopup({
          target: event.currentTarget,
          message: 'Forensic report: userhash: '+data.userhash+'  Displayname: '+data.displayname+'  Message: "'+data.text+'" You can copy and paste this and send it to your admin as evidence!',
          icon: 'pi pi-exclamation-triangle'
      });
      }}   />
      </div>
     
      </React.Fragment>;
      if (this.blockchathash.indexOf(data.userhash)===-1) {
        this.toast.show({severity:'info', content: retobj, sticky:true});
      } else console.log("chat had been blocked");
    }.bind(this));

    notepadsocket.removeAllListeners('startPoll');
    notepadsocket.on('startPoll', function(data){
      console.log("startpoll incoming",data);

      this.setState({ polltask: 1, curpoll: data, pollsel: undefined, pollvotes:{}, pollballots:[]} );
    }.bind(this));

    notepadsocket.removeAllListeners('finishPoll');
    notepadsocket.on('finishPoll', function(data){
      console.log("finishpoll incoming",data);

      this.setState({ polltask: 2,  pollsel: undefined} );
    }.bind(this));

    notepadsocket.removeAllListeners('castvote');
    notepadsocket.on('castvote', function(data){
      console.log("castvote incoming",data);
      if (data.ballotid && data.vote && data.pollid && data.pollid===this.state.curpoll.id) {
        this.setState((state) => {
          let ballots = state.pollballots;
          ballots.push({ data });
          let votes = state.pollvotes;
          votes[data.ballotid]=data.vote;

          return { pollballots: ballots, pollvotes: votes };
        });
      }

      //this.setState({ polltask: 2,  pollsel: undefined} );
    }.bind(this));

   
  }


  blockChat(userhash)
  {
    this.blockchathash.push(userhash);
  }


  



  endbuttonCallback()
  {
    // End button was pressed
    this.setState({endbuttondialog: true});
  }

  onOpenNewScreen()
  {
    this.socket.emit("createscreen",function(ret){
      sessionStorage.removeItem('failspurpose'); // workaround for cloning
      sessionStorage.removeItem('failstoken');
      let newscreen=window.open(ret.screenurl,uuidv4(),"height=600,width=1000,modal=yes,alwaysRaised=yes,menubar=yes,toolbar=yes");
      sessionStorage.setItem('failstoken', this.myauthtoken);
      sessionStorage.setItem('failpurpose','lecture');

      if (!newscreen) console.log("Opening window failed");
      else {
        setTimeout(()=> {
          newscreen.postMessage({token: ret.token, purpose: "screen"},cfg.getURL("web"));
          },1000);
      }
      console.log("createscreen answer ",ret);
    });
  }
  onOpenNewNotepad()
  {
    this.socket.emit("createnotepad",function(ret){
      sessionStorage.removeItem('failspurpose'); // workaround for cloning
      sessionStorage.removeItem('failstoken');
      let newnotepad=window.open(ret.notepadurl,uuidv4(),"height=600,width=1000,modal=yes,alwaysRaised=yes,menubar=yes,toolbar=yes");
      sessionStorage.setItem('failstoken', this.myauthtoken);
      sessionStorage.setItem('failpurpose','lecture');
      
      if (!newnotepad) console.log("Opening window failed");
      else {
        setTimeout(()=> {
          newnotepad.postMessage({token: ret.token, purpose: "lecture"},cfg.getURL("web"));
        },1000);
        
      }
      console.log("createnotepad answer ",ret);
    });
  }

  onNewWriting() {
    console.log("onnewwriting!");
    this.socket.emit("createchannel");
  }

 /* onRemoveScreen()
  {
    console.log("Remove screen",this.state.selscreen);
    this.socket.emit('removescreen',{screenuuid: this.state.selscreen.uuid});
  }*/

  onRemoveChannel(channeluuid)
  {
    console.log("Remove channel",channeluuid);
    this.socket.emit('removechannel',{channeluuid: channeluuid});
  }

  pictbuttonCallback()
  {
    // Picture button was pressed
    this.socket.emit("getAvailablePicts",function(ret){
      console.log("getAvailablePicts", ret);
      let picts=ret.map((el)=>({
        itemImageSrc: el.url,
        thumbnailImageSrc: el.urlthumb,
        id: el.sha,
        alt: el.name
      }));
      this.setState({pictbuttondialog: true,
        pictures: picts});

    }.bind(this));

   /* let dummypicthelp=dummypict.default;

    let picts= [{itemImageSrc: dummypicthelp , thumbnailImageSrc: dummypicthelp, alt: "Dummy Pict", title: "Dummy Pict",id:1, uuid: "d1f4387e-5793-4d13-a16a-28572ebcbc18" },
    {itemImageSrc: dummypicthelp , thumbnailImageSrc: dummypicthelp, alt: "Dummy Pict2", title: "Dummy Pict2",id:2, uuid: "d1f4387e-5793-4d13-a16a-28572ebcbc18" },
    {itemImageSrc: dummypicthelp , thumbnailImageSrc: dummypicthelp, alt: "Dummy Pict3", title: "Dummy Pict3",id:2, uuid: "d1f4387e-5793-4d13-a16a-28572ebcbc18" } ];*/
   
  }

  onHideMainDialog()
  {
    this.setState({endbuttondialog: false});
    if (this.noteref) {
      this.noteref.setHasControl(true);
      this.noteref.reactivateToolBox();
    }
  }

  onHidePictDialog()
  {
    this.setState({pictbuttondialog: false});
    if (this.noteref) {
      this.noteref.setHasControl(true);
      this.noteref.reactivateToolBox();
    }
  }

  onAddPicture()
  {
    this.setState({pictbuttondialog: false});
    if (this.noteref) {
      let pict=this.state.pictures[this.state.pictIndex];
      this.noteref.receivePictInfo({uuid: pict.id,url: pict.itemImageSrc}); 
      this.noteref.enterAddPictureMode(pict.id,
                        pict.itemImageSrc/*URL*/);
    }
  }

  onStartPoll()
  {
    
    this.setState({polltask: 0});
    this.onHideMainDialog();

    this.socket.emit("getPolls",function(ret){
      console.log("getPolls", ret);
      this.setState({pollcoll: ret});

    }.bind(this));
    
  }

  onStartSelPoll()
  {
    if (!this.state.pollcoll) return;
    let polfind=this.state.pollcoll.find((el)=>(el.id===this.state.pollsel));
    this.socket.emit("startPoll", {
      poll: polfind
    });
  }

  onFinishSelPoll()
  {
    if (!this.state.curpoll) return;
    let result=this.calcPollresults();
    let tresult=[];
    for (let res in result){
      let mine=this.state.curpoll.children.find((el)=>(el.id===res));  
      tresult.push({id: res, data: result[res], name: mine.name});
    }
    this.socket.emit("finishPoll", {
      pollid: this.state.curpoll.id,
      result: tresult
    });
  }

  addNotescreenToChannel(channeluuid, uuid)
  {
    console.log("Add screen with uuid");
    this.socket.emit("addnotescreentochannel", {
      channeluuid: channeluuid,
      notescreenuuid: uuid
    });
  }

  itemGalleriaTemplate(item){
      return <img src={item.itemImageSrc} alt={item.alt} style={{ width: '100%', display: 'block' }} />
  };

  thumbnailGalleriaTemplate(item) {
      return <img src={item.thumbnailImageSrc} alt={item.alt} style={{ height: '40px', display: 'block' }} />
  }

  pollTemplate(item)
  {
    console.log("itemlog", item);
    let childlist=[];
    if (item.children) childlist=item.children.map(el=>(<li>{el.name}</li> ));
    return <div>
      <h3> {item.name+ (item.multi? " (multi)": " (single)")} </h3>
      <ol>
      {childlist}
      </ol>
    </div>
  }

  calcPollresults() {
    let tpolldata = {};
    this.state.curpoll.children.forEach((el) => { tpolldata[el.id] = 0; });
    let helper = (el2) => {
      if (el2) {
        if (el2 in tpolldata) tpolldata[el2]++;
      }
    };
    for (let el in this.state.pollvotes) {
      // the element
      let cur = this.state.pollvotes[el];
      

      if (this.state.curpoll.multi) {
        cur.forEach(helper);
      } else {
        helper(cur);
      }
    }
    console.log("tpolldata", tpolldata);
    return tpolldata;
  }


  render(){
  
    let polldata={};

    if (this.state.polltask===1 || this.state.polltask===2) {
      let tpolldata=this.calcPollresults();
      
      polldata={labels:[], datasets: [{data: [], label: 'number of votes', type: 'bar', backgroundColor: "#CAFEB8" , borderColor:"#D3D3D3", borderDash: [5, 5], fill: true}]};
      for (let choice in tpolldata) {
        let mine=this.state.curpoll.children.find((el)=>(el.id===choice));
        polldata.labels.push(mine.name);
        polldata.datasets[0].data.push(tpolldata[choice]);
      }
      console.log("polldata", polldata);

    }


    //if (this.decoded_token()) console.log("decoded token",this.decoded_token(), this.decoded_token().notepadhandler);

    const pollitems= [{label: "Choose" },{label: "Poll"},{label:"Results"}];

    //console.log("pictures",this.state.pictures);
    return <div >
      <Toast ref={(el) => this.toast = el} position="top-left" />
      <NoteScreenBase endbuttoncallback={this.endbuttonCallback} netsend={(this.decoded_token() && this.decoded_token().notepadhandler ) ?this.netSendSocket : this.netSendShortCircuit} isnotepad={true} 
         pictbuttoncallback={this.pictbuttonCallback} backgroundcolor={this.state.bgpdf ? "#FFFFFF" :( this.state.blackbackground?  "#505050": "#efefef") } screennumbercolor={this.state.blackbackground ?  "#FFFFFF": "#000000" }
         screennumber={this.state.notescreenid}
         width={this.props.width} height={this.props.height} noteref={this.getNoteRef} updateSizes={this.updateSizes} showscreennumber={this.state.showscreennumber} ></NoteScreenBase>

        <Dialog header="Select picture" visible={this.state.pictbuttondialog} style={{ width: '50vw' }} onHide={this.onHidePictDialog}  >  
        <div className="p-grid">
        <div className="p-col-12">
        <Galleria value={this.state.pictures} item={this.itemGalleriaTemplate} thumbnail={this.thumbnailGalleriaTemplate} activeIndex={this.state.pictIndex} changeItemOnIndicatorHover={true} 
                onItemChange={(e) => this.setState({pictIndex:e.index})}></Galleria>
        </div>
        <div className="p-col-6">
        <Button label="Add to lecture" icon="pi pi-plus" onClick={this.onAddPicture} />
        </div>
        </div>
        </Dialog>
      
        <Dialog header="Main menu" visible={this.state.endbuttondialog}  onHide={this.onHideMainDialog} >
        <div className="p-grid">
        <div className="p-col-7">
        
        <ChannelEdit channelinfo={this.state.channelinfo} availscreens={this.state.availscreens} app={this}></ChannelEdit>
        
        
        </div>
        <div className="p-col-5">
        <div className="p-col-12">
        <Button label="Toggle fullscreen" icon="pi pi-window-maximize" className="p-m-2" onClick={()=>{ screenfull.toggle()}} />
        </div>
        <div className="p-col-12">
        <Button label="Start poll" icon="pi pi-chart-bar" className="p-m-2" onClick={ this.onStartPoll} />
        </div>
        <div className="p-col-12">
        <Checkbox inputId="casttoscreens"  onChange={(e)=>this.updateSizes({casttoscreens: e.checked})} checked={this.state.casttoscreens}></Checkbox>
        <label htmlFor="casttoscreens" className="p-checkbox-label p-m-2">Show to screens/students</label>
        </div>
        <div className="p-col-12">
        <Checkbox inputId="showscreennumber"  onChange={(e)=>this.updateSizes({showscreennumber: e.checked})} checked={this.state.showscreennumber}></Checkbox>
        <label htmlFor="showscreennumber" className="p-checkbox-label p-m-2">Show number</label>
        </div>


          
        {!this.state.bgpdf && <div className="p-col-12">
        <Checkbox inputId="blackbackground"  onChange={(e)=>this.updateSizes({blackbackground: e.checked})} checked={this.state.blackbackground}></Checkbox>
        <label htmlFor="blackbackground" className="p-checkbox-label p-m-2">Dark background</label>
        </div>} 
        </div> 
        
        </div>

        
        </Dialog>
        <Dialog header="Poll" visible={typeof this.state.polltask !== 'undefined'} onHide={()=>{this.setState({polltask: undefined, pollsel: undefined})}} >
        <Steps model={pollitems} activeIndex={this.state.polltask} />
        {this.state.polltask===0 && <React.Fragment>
          
        <ListBox value={this.state.pollsel} className="p-m-2" options={this.state.pollcoll && this.state.pollcoll.filter((el)=>(el.children && el.children.length>1))} 
              optionLabel="name" optionValue="id" itemTemplate={this.pollTemplate} onChange={(e) => this.setState({pollsel: e.value})}  />
        { this.state.pollsel && <Button label="Start poll" icon="pi pi-chart-bar" className="p-m-2" onClick={ this.onStartSelPoll} />}
        </React.Fragment>
        }
        {(this.state.polltask===1 || this.state.polltask===2)  && <React.Fragment>
          <h3> {this.state.curpoll.name +((this.state.curpoll.multi?" (multi)":" (single)"))}</h3>
          <Chart type="bar" data={polldata} options={{
            indexAxis: 'y',
            maintainAspectRation: false,
            aspectRatio: .8,
            

          }} />
          {(this.state.polltask===1) &&<Button label="Finish poll" icon="pi pi-chart-bar" className="p-m-2" onClick={ this.onFinishSelPoll} /> }
          {(this.state.polltask===2) &&<React.Fragment> <h4> Voting is over!</h4> 
          <Button label="Report to Clipboard" icon="pi pi-copy" className="p-m-2" 
          onClick={ ()=>(navigator.clipboard && navigator.clipboard.writeText(JSON.stringify( {ballots: this.state.pollballots,poll: this.state.curpoll, votes: this.state.pollvotes })))} /> </React.Fragment> }
        </React.Fragment>}

        </Dialog>
    
    
    </div>
}
}

export class FailsScreen extends FailsBasis
{
  constructor(props)
  {
    super(props);
    this.state={};
    this.state.casttoscreens=false; // may be move to base class
    this.state.showscreennumber=false;
    this.state.blackbackground=true;
    this.state.lectdetail=null;

    
    

    this.notepaduuid=null;

  }



  componentDidMount() 
  {
      console.log("Component mount FailsScreen");
      if (this.decoded_token().notepadhandler)
      {
         this.socket=io(this.decoded_token().notepadhandler+"/screens", {
          'auth': this.authCB /*+ sessionStorage.getItem("FailsAuthtoken")*/, 
          multiplex: false
        });
        this.initializeScreenSocket(this.socket);
      }
      this.commonMount();


  }

  componentWillUnmount() 
  {
    console.log("Component unmount FailsScreen");
    if (this.socket) {
      this.socket.disconnect();
      this.socket=null;
    }
    this.commonUnmount();
  }

  initializeScreenSocket(screensocket)
  {
    this.initializeCommonSocket(screensocket);
   // TODO convert to react
    screensocket.removeAllListeners('lecturedetail');
    screensocket.on('lecturedetail',function(data) {
      console.log("got lecture detail",data);
        this.setState({lectdetail: data });
        
    }.bind(this));   

    /*screensocket.removeAllListeners('removeScreen');
    screensocket.on('removeScreen',function(data) {
        
        this.setState((state)=> {let newld=state.lecturedetail;
          if (newld) newld.notepaduuid=null;
          return {casttoscreens: false,
                      screenmode:"removed",
                      lectdetail: newld
                        };});
        console.log("screen was removed from notepad ");
        
        this.setState({casttoscreens: false  } );
    }.bind(this));*/

   


    screensocket.removeAllListeners('connect');
    screensocket.on('connect',function(data) {

               // todo imform size
    this.updateSizes();
    console.log("screensocket connect",data);
    this.setState((state)=> {return {casttoscreens: false,
      showscreennumber: false,
      screenmode: "connected"
        };});
        this.scheduleReauthor();
      }.bind(this));

    screensocket.removeAllListeners('disconnect');
    screensocket.on('disconnect',function(data) {
      this.setState((state)=> {return {casttoscreens: false,
        showscreennumber: false,
       screenmode: "disconnected"  
         };});
      
      console.log("screensocket disconnect");
       
      }.bind(this));

  
    
    
  }

  renderScreenText() {
    var lectinfo=null;
    if (this.state.lectdetail) {
      lectinfo=<div  style={{ textAlign: "center"}} ><h1>{this.state.lectdetail.coursetitle}</h1> 
      <h4> {this.state.lectdetail.instructors.join(", ")} </h4>
       <h2>{this.state.lectdetail.title}</h2>
      {this.state.lectdetail.todaysinstructor && <div>
          today held by <br></br> {this.state.lectdetail.todaysinstructor.join(", ")}</div>
            }
             <h4> is coming up </h4><br></br> 
           </div>
    }
    let screenunassigned=true;
    if (this.state.lectdetail && this.state.lectdetail.notepaduuid) screenunassigned=false;
    switch(this.state.screenmode)
    {
      case "connected": 
        return  <div style={{ textAlign: "center"}} > {lectinfo && lectinfo}
        {screenunassigned && <React.Fragment><h2> Screen connected: </h2> <h3>ID: {this.state.notescreenid+1} </h3>
        <h4>UUID: {this.decoded_token().notescreenuuid}</h4> Start casting lecture!  </React.Fragment>}</div> ;
      
      case "disconnected": 
       return <div style={{ textAlign: "center"}}  >  {lectinfo && lectinfo}
         <h2> Screen disconnected: </h2> <h3>ID: {this.state.notescreenid+1} </h3>
        <h4>UUID: {this.decoded_token().notescreenuuid}</h4>  </div>;
      
      case "removed": 
        return  <div style={{ textAlign: "center"}} >  {lectinfo && lectinfo}
       {screenunassigned && <React.Fragment> <h2> Screen connected: </h2> <h3>ID: {this.state.notescreenid+1} </h3>
        <h4>UUID: {this.decoded_token().notescreenuuid}</h4>
         Screen was removed! <br></br> 
         Start casting lecture! </React.Fragment>} </div> 

      
      /*case "lecture": {
        return <div  style={{ textAlign: "center"}} ><h1>{this.state.lectdetail.coursetitle}</h1> 
        <h4> {this.state.lectdetail.instructors.join(", ")} </h4>
         <h2>{this.state.lectdetail.title}</h2>
        {this.state.lectdetail.todaysinstructor && <div>
            today held by <br></br> {this.state.lectdetail.todaysinstructor.join(", ")}</div>
              }
               <h4> is coming up </h4>
               <tiny> [{this.decoded_screentoken.screenuuid}]  </tiny>
             </div>
       
      };*/
      default: {
        return <div>Not activated!</div>
      }

    }
  }


  render() {
    console.log("current states",this.state);
    return <div>
      
      <Toast ref={(el) => this.toast = el} position="top-left" />
      <NoteScreenBase   isnotepad={false} showscreennumber={this.state.showscreennumber} screennumber={this.state.notescreenid}
        backgroundcolor={this.state.bgpdf ? "#FFFFFF" :( this.state.blackbackground?  "#505050": "#efefef") }
          screennumbercolor={(this.state.blackbackground &&  this.state.casttoscreens) ?  "#FFFFFF": "#000000" }
         width={this.props.width} height={this.props.height} noteref={this.getNoteRef} updateSizes={this.updateSizes} ></NoteScreenBase>
         <Sidebar visible={!this.state.casttoscreens} position="top" style={{width:'100%',height:'90%',zIndex: 0}} showCloseIcon={false} onHide={() => {}}  >
           {(this.state.screenmode) && this.renderScreenText()}
         </Sidebar>
         </div>
  }

}

export class FailsNotes extends FailsBasis
{
  constructor(props)
  {
    super(props);
    this.state={};
    this.state.casttoscreens=false; // may be move to base class
    this.state.blackbackground=true;
    this.state.lectdetail=null;

    this.state.pageoffset=0;
    this.state.scrollunlock=false;

    this.state.chattext="";

    
    

    this.notepaduuid=null;

    this.toggleScrollUnlock=this.toggleScrollUnlock.bind(this);
    this.sendChatMessage=this.sendChatMessage.bind(this);
    this.onVoteSel=this.onVoteSel.bind(this);
    this.onCastvote=this.onCastvote.bind(this);

  }



  componentDidMount() 
  {
      console.log("Component mount FailsNotes");
      console.log("decoded token",this.decoded_token() );
      if (this.decoded_token().noteshandler)
      {
         this.socket=io(this.decoded_token().noteshandler+"/notes", {
          'auth': this.authCB /*+ sessionStorage.getItem("FailsAuthtoken")*/, 
          multiplex: false
        });
        this.initializeNotesSocket(this.socket);
      }
      this.commonMount();


  }

  componentWillUnmount() 
  {
    console.log("Component unmount FailsScreen");
    if (this.socket) {
      this.socket.disconnect();
      this.socket=null;
    }
    this.commonUnmount();
  }

  initializeNotesSocket(notessocket)
  {
    this.initializeCommonSocket(notessocket);
   // TODO convert to react
    notessocket.removeAllListeners('lecturedetail');
    notessocket.on('lecturedetail',function(data) {
      console.log("got lecture detail",data);
        this.setState({lectdetail: data });
        
    }.bind(this));   

  

    notessocket.removeAllListeners('connect');
    notessocket.on('connect',function(data) {

               // todo imform size
    
    console.log("notessocket connect",data);
   
        this.scheduleReauthor();
      }.bind(this));

    notessocket.removeAllListeners('disconnect');
    notessocket.on('disconnect',function(data) {
     
      
      console.log("notessocket disconnect");
       
      });


    notessocket.removeAllListeners('startPoll');
    notessocket.on('startPoll', function(data){
      console.log("startpoll incoming",data);

      this.setState({ polltask: 1, curpoll: data, votesel: [], pollvotes:{},polldata: undefined} );
    }.bind(this));

    notessocket.removeAllListeners('finishPoll');
    notessocket.on('finishPoll', function(data){
      console.log("finishpoll incoming",data);

      this.setState({ polltask: 2,  pollsel: undefined, polldata: data.result} );
    }.bind(this));

  
    
    
  }

  toggleScrollUnlock()
  {
    let curoffset=this.noteref.calcCurpos();

    this.setState((state)=>{
      if (state.scrollunlock) {
        return {scrollunlock: !state.scrollunlock,
              pageoffset:0};
      } else {
        return {scrollunlock: !state.scrollunlock,
            pageoffset: curoffset};
      }
    });
  }

  sendChatMessage(){
    console.log("Send chat message",this.state.chattext);
    this.netSendSocket('chatquestion',{text: this.state.chattext});

    this.setState({chattext: ""});
    this.chatop.hide();
  }

  onVoteSel(e) {
    console.log("onVoteSel", e, this.state.votesel);
    if (this.state.curpoll.multi) {
      if (e.checked) {
        this.setState((state) => {
          let temp = state.votesel;
          temp.push(e.value);
          return { votesel: temp };
        });
      } else
        this.setState((state) => {
          let temp = state.votesel;
          temp.votesel.splice(temp.votesel.indexOf(e.value), 1);
          return { votesel: temp };
        });
    } else {
      if (e.checked) this.setState({votesel: e.value});
    }

  };

  onCastvote()
  {
    this.socket.emit('castvote',{selection: this.state.votesel, pollid: this.state.curpoll.id},
    function(ret){
      console.log("cast vote incl ballot id", ret);
      this.setState({pollballotid: ret.ballot});
    }.bind(this));
    this.setState( {polltask: 2, votesel: undefined});
  }



  render() {
    //console.log("current states", this.state);

    let pollsels=[];
    

    let polldata=null;

    if ( this.state.polltask===2 && this.state.polldata) {
      let pd=this.state.polldata;
      
      polldata={labels:pd.map((el)=>(el.name)), datasets: [{data: pd.map((el)=>(el.data)), label: 'number of votes', type: 'bar', backgroundColor: "#CAFEB8" , borderColor:"#D3D3D3", borderDash: [5, 5], fill: true}]};
      

    }

    if (this.state.polltask===1 && this.state.curpoll)
    {
      
      pollsels= this.state.curpoll.children.map((el)=> <div className="p-col-12">
      <Checkbox inputId="cb2" value={el.id} onChange={this.onVoteSel} checked={this.state.curpoll.multi ? this.state.votesel.includes(el.id): this.state.votesel===el.id }></Checkbox>
      <label htmlFor="cb2" className="p-checkbox-label p-m-2">{el.name}</label>
      </div>);
    }


    return <div>
       <Toast ref={(el) => this.toast = el} position="top-left" />

      <NoteScreenBase isnotepad={false} pageoffset={this.state.pageoffset}  pageoffsetabsolute={this.state.scrollunlock}
        backgroundcolor={this.state.bgpdf ? "#FFFFFF" : (this.state.blackbackground ? "#505050" : "#efefef")}
        screennumbercolor={(this.state.blackbackground && this.state.casttoscreens) ? "#FFFFFF" : "#000000"}
        width={this.props.width} height={this.props.height} noteref={this.getNoteRef} updateSizes={this.updateSizes} ></NoteScreenBase>
        <div style={{position: 'absolute', top: "2vh" ,left: "1vw"}} >
        <div>
        <Button  icon={this.state.scrollunlock ? "pi pi-lock-open" :"pi pi-lock" }  className="p-button-raised p-button-rounded p-m-2" onClick={this.toggleScrollUnlock} />
        <Button  icon="pi pi-arrow-up" className="p-button-raised p-button-rounded p-m-2" 
                onClick={()=>(this.setState((state)=>({pageoffset: state.scrollunlock? Math.max(0,state.pageoffset-0.5) : state.pageoffset-0.5})))} />  
        <InputText value={this.state.pageoffset} disabled style={{width:'40px'}}  className="p-inputtext-sm p-m-2" />
       
        <Button  icon="pi pi-arrow-down" className="p-button-raised p-button-rounded p-m-2" onClick={()=>(this.setState((state)=>({pageoffset: state.pageoffset+0.5})))}  />
        <Button  icon="pi pi-comment" className="p-button-raised p-button-rounded p-m-2" onClick={(e) => this.chatop.toggle(e)} aria-haspopup aria-controls="overlay_panel" />

        <OverlayPanel ref={(el) => this.chatop = el}>
        {this.detectLatex(this.state.chattext) && <React.Fragment>
         <h4>Preview: </h4>
          {  this.convertToLatex(this.state.chattext) }
          <br></br>
        </React.Fragment>}
        <h4>Question ($...$ for math):</h4>
        <InputTextarea rows={5} cols={30} value={this.state.chattext} onChange={(e) => this.setState({chattext:e.target.value})} autoResize />
        
        {this.state.chattext!=="" &&<Button  icon={"pi pi-send" }  className="p-button-raised p-button-rounded p-m-2" onClick={this.sendChatMessage} />}
        </OverlayPanel>
        </div>
        
        </div>
        <Dialog header="Poll" visible={typeof this.state.polltask !== 'undefined'} closable={this.state.polltask===2} onHide={()=>{this.setState({polltask: undefined, pollsel: undefined, polldata: undefined})}} >
        {(this.state.polltask===1 )  && <React.Fragment>
          <h3> {this.state.curpoll.name+((this.state.curpoll.multi?" (multi)":" (single)")) }</h3>
          {pollsels}
          {(this.state.curpoll.multi ? this.state.votesel.length>0: this.state.votesel) &&<Button label="Cast vote" icon="pi pi-chart-bar" className="p-m-2" onClick={ this.onCastvote} /> }
          
          </React.Fragment>}
        {( this.state.polltask===2)  && <React.Fragment>
          <h3> {this.state.curpoll.name+((this.state.curpoll.multi?" (multi)":" (single)")) }</h3>
          { polldata && <React.Fragment>
          <Chart type="bar" data={polldata} options={{
            indexAxis: 'y',
            maintainAspectRation: false,
            aspectRatio: 1.3,           

          }} />
          <h4> Voting is over!</h4> 
          </React.Fragment>
          }
          { !polldata && <h4> Votes are still casted! </h4> }
          {this.state.pollballotid && <h4>My ballot id: {this.state.pollballotid}</h4>}
          
        </React.Fragment>}

        </Dialog>
      

    </div>
  }

}