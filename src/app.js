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

import React, { useState }  from 'react'
import 'primereact/resources/themes/nova/theme.css';
import 'primereact/resources/primereact.min.css';

import { FailsBoard, FailsScreen, FailsNotes } from './main.js'
import './index.css'

import {FailsConfig} from '@fails-components/config';

let cfg=new FailsConfig({react: true});

let purposesetter=(purpose)=>{console.log("old setter")};


let gotmessage=false;

window.addEventListener("message", (event) => {
  console.log("message from",event.origin,"data:",event.data);
  if (event.origin !== cfg.getURL("appweb") && event.origin !== cfg.getURL("web")
    && event.origin !== window.location.origin){
    console.log("origin check", event.origin, cfg.getURL("appweb"),cfg.getURL("web") );
    return;
  }

  if (event.data && event.data.token && event.data.purpose && !gotmessage) {
    gotmessage=true;
    sessionStorage.setItem('failspurpose',event.data.purpose);
    sessionStorage.setItem('failstoken',event.data.token);
    console.log("purpose",event.data.purpose );
    purposesetter(event.data.purpose);
  }
}, false);




const App = () => {


  const [purpose, setPurpose] = useState(sessionStorage.getItem('failspurpose'));

  purposesetter=setPurpose;

  

 console.log("app purpose",purpose);




  if (purpose==="lecture") {
    //window.failstoken="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3RlciIsInB1cnBvc2UiOiJub3RlcGFkIiwibGVjdHVyZXV1aWQiOiIwMGM1OTk0YS0wMTg0LTQxZjEtYjRhOC00YmMxYzBkNDg3ODciLCJub3RlcGFkdXVpZCI6IjY0OTdjMmFkLWJhZTMtNGMzNy04MjJhLWFiN2IwYmYwMzNjZSIsImlhdCI6MTYxODc1NjA4NCwiZXhwIjoxNjE4ODQyNDg0fQ.Df9u4j_GFwB2RGFiGxER-PZ89JbBE-IGmubs5B0jUr0";
    //const urlpara=new URLSearchParams(window.location.search);
    //let token = urlpara.get('token');

    
    return <FailsBoard width="100vw" height="100vh" ></FailsBoard>
  } else if (purpose==="screen") {
      return <FailsScreen width="100vw" height="100vh" ></FailsScreen>
  } else if (purpose==="notes") {
    return  <FailsNotes width="100vw" height="100vh" ></FailsNotes>
  } else {
    return <div>Loading, waiting for authorization token and  purpose!</div>    
  }
}

export default App
