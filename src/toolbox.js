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
import React, { Component, Fragment } from 'react';

class SVGPathString
{
    constructor()
    {
        this.string="";
    }

    moveTo(x,y)
    {
        this.string=this.string+"M"+x+","+y+" ";
    }

    lineTo(x,y)
    {
        this.string=this.string+"L"+x+","+y+" ";
    }

    close()
    {
        this.string=this.string+"Z";
    }
}

class CircleElement extends Component
{
    
    render() {
        var offset=0;
        var dangle=2.*Math.PI*this.props.cpos/this.props.clength;
        var radius=this.props.radius*this.props.cpos;
        let x=-Math.cos(offset+dangle*this.props.id)*radius+radius;
        let y=Math.sin(offset+dangle*this.props.id)*radius+radius;

        return <div style={{position: 'absolute', top: x ,left: y}}>
            {this.props.children}
        </div>
         
    }

};

class CircleWrap extends Component
{

    render() {
        var radius=(this.props.radius)*this.props.cpos+20;
        return <span style={{left: -radius+"px", top:(-radius)+"px",
            width: 2*radius+"px", height:2*radius+"px",
         borderRadius: radius+"px", backgroundColor: "#3d3d3d",
          borderColor: "#001A00", borderWidth: "1.5px",
                display:"inline-block", position: "absolute"/*, opacity: "0.8"*/}}>
                {this.props.children}
            </span>;
         
    }

};






class  FilledButton extends Component {

    constructor(props)
    {
        super(props);
        this.pointerdown=this.pointerdown.bind(this);
        this.pointerup=this.pointerup.bind(this);
        this.pointermove=this.pointermove.bind(this);
    };

 

   

    

    

    pointerdown(pointer) {
        if (this.props.buttonid) this.props.toolbox.selectTool(this.props.buttonid);
        if (this.props.pointerdown) this.props.pointerdown(pointer);
    };

    pointermove(pointer) {
        if (this.props.pointermove) this.props.pointermove(pointer);
    }

    pointerup(pointer) {
        if (this.props.pointerup) this.props.pointerup(pointer);
    }

    render() {
        var radius=this.props.radius ? this.props.radius: 20;
        let background="#001A00";
        let bordercolor="#3d3d3d";
        if (!this.props.selected)
        {
            bordercolor="#001A00";
            background="#3d3d3d";
        }
        return <span style={{
            width: 2*radius+"px", height: 2*radius+"px", borderRadius: radius+"px", backgroundColor: background,
             borderColor: bordercolor, borderWidth: "1.5px", display: "inline-block",overscrollBehavior: "none", touchAction: "none"}} onPointerDown={this.pointerdown} onPointerMove={this.pointermove}
             onPointerUp={this.pointerup}
             onPointerLeave={this.pointerup} >
                 {this.props.children}
            </span>;
    }
};

class    ScrollButton extends Component {
    constructor(props)
    {
        super(props);
        this.state={};
        this.state.scrollmodeactiv=false;
        this.state.mousescrollx=this.state.mousescrolly=0;

        this.initPath();

        this.pointerdown=this.pointerdown.bind(this);
        this.pointerup=this.pointerup.bind(this);
        this.pointermove=this.pointermove.bind(this);
    };

    initPath()
    {
       var  path=new SVGPathString();
  
        path.moveTo(0,-15);
        //this.currentPath.shape.closed=false;
        path.lineTo(0,15);
        path.moveTo(-6,8);
        //this.currentPath.shape.closed=false;
        path.lineTo(0,15);
        path.moveTo(6,8);
        //this.currentPath.shape.closed=false;
        path.lineTo(0,15);
        path.moveTo(-6,-8);
        //this.currentPath.shape.closed=false;
        path.lineTo(0,-15);
        path.moveTo(6,-8);
        //this.currentPath.shape.closed=false;
        path.lineTo(0,-15);
        //path.close();
        this.pathstring=path.string;
    }




  

    pointerdown(event) {

        this.setState({mousescrollx:event.clientX, 
            mousescrolly: event.clientY, selected: true,
            scrollmodeactiv: true});
        this.props.toolbox.scrollboardSetReference();
       
    };

   

    pointermove(event) {
        // TODO
        if (this.state.scrollmodeactiv) {
            this.props.toolbox.scrollboard(0,-event.clientY+this.state.mousescrolly);
        }
    };

  

    pointerup(event) {
        this.setState({ selected: false,
            scrollmodeactiv: false});
    };

    render() {
        
        return <FilledButton toolbox={this.props.toolbox} selected={this.state.selected} buttonid={this.props.buttonid} 
        radius={this.state.selected? 35: 20}
        pointerdown={this.pointerdown}
        pointermove={this.pointermove}
        pointerup={this.pointerup} > 
        <svg viewBox="-20 -20 40 40" width="100%" height="100%">
        <path d={this.pathstring} stroke="#FFFFCC" strokeWidth="4" strokeLinecap="round" fill="none" ></path>
        </svg>
        </FilledButton>
        
    }
}

class EndButton extends Component {
    constructor(props)
    {
        super(props);
        this.pointerdown=this.pointerdown.bind(this);
        this.pointerup=this.pointerup.bind(this);
    };


 

    pointerdown(event) {
        this.setState({ selected: true});
        this.props.toolbox.endButtonPressed();
    };

    pointerup(event)
    {
        this.setState({ selected: false});
    }

    render() {
        return <FilledButton toolbox={this.props.toolbox} selected={this.props.selected} buttonid={this.props.buttonid}  pointerdown={this.pointerdown}
                    pointerup={this.pointerup}> 
        <svg viewBox="-20 -20 40 40" width="100%" height="100%">
        <path d={"M 6 10 A 12 12 0 1 0 -6 10"} stroke="#FFFFCC" strokeWidth="4" strokeLinecap="round" fill="none" ></path>
        <line x1={0} y1={0} x2={0} y2={15} stroke="#FFFFCC"strokeWidth="4" strokeLinecap="round" ></line>
        </svg>
        </FilledButton>
        
    }
};

class PictButton extends Component {
    constructor(props)
    {
        super(props);
        this.pointerdown=this.pointerdown.bind(this);
        this.pointerup=this.pointerup.bind(this);
    }; 

 
    pointerdown(event) {
        this.setState({ selected: true});
        this.props.toolbox.pictButtonPressed();
    };

    pointerup(event)
    {
        this.setState({ selected: false});
    }

    render() {
        return <FilledButton toolbox={this.props.toolbox} selected={this.props.selected} buttonid={this.props.buttonid}  pointerdown={this.pointerdown}
        pointerup={this.pointerup}> 
         <svg viewBox="-20 -20 40 40" width="100%" height="100%">
        <ellipse cx="-5" cy="-5" rx="10" ry="10" fill="#cc0000" fillOpacity={0.7} stroke="#FFFFCC" strokeWidth={1} strokeOpacity={0} ></ellipse>

        <rect x="-2" y="-2" width="15" height="15" fill="#00cc00" fillOpacity={0.7} stroke="#FFFFCC" strokeWidth={1} strokeOpacity={0} ></rect>

        </svg>
        </FilledButton>
        
    }
};

class OkButton extends Component {
    constructor(props)
    {
        super(props);
        this.initPath();
        this.pointerdown=this.pointerdown.bind(this);
    };

    initPath()
    {
       var  path=new SVGPathString();
       path.moveTo(-15,0);
       //this.currentPath.shape.closed=false;
       path.lineTo(-8,15);
       path.lineTo(8,-8);
       //path.close();
       this.pathstring=path.string;
    }


    pointerdown(event) {
        this.props.toolbox.okButtonPressed();
    };

    render() {
        return <FilledButton toolbox={this.props.toolbox} selected={this.props.selected} buttonid={this.props.buttonid} pointerdown={this.pointerdown}> 
        <svg viewBox="-20 -20 40 40" width="100%" height="100%">
        <path d={this.pathstring} stroke="#00cc00" strokeWidth="4" strokeLinecap="round" fill="none" ></path>
        </svg>
        </FilledButton>
        
    }
};

class CancelButton extends Component {
    constructor(props)
    {
        super(props);
        this.initPath();
        this.pointerdown=this.pointerdown.bind(this);
    };

    initPath()
    {
       var  path=new SVGPathString();
       path.moveTo(-8,8);
       //this.currentPath.shape.closed=false;
       path.lineTo(8,-8);
       path.moveTo(-8,-8);
       path.lineTo(8,8);
       //path.close();
       this.pathstring=path.string;
    }



    pointerdown(event) {
        this.props.toolbox.cancelButtonPressed();
    };

    render() {
        return <FilledButton toolbox={this.props.toolbox} selected={this.props.selected} buttonid={this.props.buttonid} pointerdown={this.pointerdown}> 
        <svg viewBox="-20 -20 40 40" width="100%" height="100%">
        <path d={this.pathstring} stroke="#cc0000" strokeWidth="4" strokeLinecap="round"  fill="none"></path>
        </svg>
        </FilledButton>
        
    }
};

 class   DrawFilledButton extends Component {

    constructor(props)
    {
        super(props);
        this.initPath();
    };

     initPath() {
         var path = new SVGPathString();

         path.moveTo(-10, -3);
         path.lineTo(-8, 3);
         path.lineTo(-6, -3);
         path.lineTo(-4, 4);
         path.moveTo(-2, -4);
         path.lineTo(0, 3);
         path.lineTo(2, -5);
         path.lineTo(4, 2);
         path.lineTo(6, 8);
         path.lineTo(8, 10);
         path.lineTo(10, 12);
         path.lineTo(-9, 13);
         //path.close();
         this.pathstring = path.string;

         if (this.props.marker) {
             var markerpath = new SVGPathString();
             markerpath.moveTo(-10, 0);
             markerpath.lineTo(0, -2);
             markerpath.lineTo(12, 2);
             //markerpath.close();
             this.markerpathstring = markerpath.string;
         }

    }

   

   

    
    render() {
        var pencolor="#99FF99";
        var penalpha=1.0;
        if (!this.props.marker) {
            pencolor=this.props.color;
            penalpha=this.props.alpha;
        }
        return <FilledButton toolbox={this.props.toolbox} selected={this.props.selected} buttonid={this.props.buttonid}> 
        <svg viewBox="-20 -20 40 40" width="100%" height="100%">
        <path d={this.pathstring} stroke={pencolor} strokeWidth="2" strokeOpacity={penalpha} strokeLinecap="round" fill="none"></path>
        {this.props.marker &&  <path d={this.markerpathstring} stroke={this.props.color} strokeWidth="8" strokeOpacity={this.props.alpha} strokeLinecap="round" fill="none" ></path> }
        </svg>
        </FilledButton>
        
    }
};




class  ColorPickerButton extends Component {

    constructor(props)
    {
        super(props);
      
        this.pointerdown=this.pointerdown.bind(this);
    };


    

    pointerdown(pointer) {
        console.log("pointer down",pointer);
        this.props.toolbox.selectColor(this.props.pickerid,this.props.color,this.props.mysize);
    };

    render() {
        return <FilledButton toolbox={this.props.toolbox} selected={this.props.selected} buttonid={this.props.buttonid} pointerdown={this.pointerdown} > 
        <svg viewBox="-20 -20 40 40" width="100%" height="100%">
        { (this.props.size*0.5<10) &&  <circle cx="0" cy="0" r={10} stroke="#001A00" strokeWidth="0" fill="#001A00"  />}
        <circle cx="0" cy="0" r={this.props.size*this.props.sizefac*0.5} stroke="#001A00" strokeWidth="0" fill={this.props.color} fillOpacity={this.props.alpha} />
        </svg>
        </FilledButton>
        
    }
};


 export class ToolBox extends Component {
    constructor(props)
    {
        super(props);
        if (this.blackboard()) this.blackboard().current.toolbox=this;
        this.stage=props.stage;

        this.state={};

       
        

       
        this.state.posy=0.1; 
        
        console.log("bbwidth in tb",this.props.bbwidth);
        this.state.scalefac=1.2*0.45*this.props.bbwidth/1000;

        this.state.scale={x: this.state.scalefac, y: this.state.scalefac};

        this.state.pencolor="#FFFFFF";//"#99FF99";
        this.state.markercolor="#CCFF33";
        this.state.pensize=1.;
        this.state.selectedButtonid=5;
        this.state.secondtoolstep=false;
        this.state.selectedPickerid=1;

        this.tbx=0.87; //constant toolbox pos
        this.lastpostime=Date.now();

        this.secondtoolnum=0;


        this.lastUpdateTime = performance.now();

        //dynamics

        this.lastdrawpos = false;
        this.lastdrawposx = 0;
        this.lastdrawposy = 0;

        this.lastvx= 0;
        this.lastvy= 0;

        this.colorwheelcolors = ["#FFFFFF","#844D18","#BFBFBF" ,"#000000", "#FF7373",
            "#FFAC62","#FFF284","#CAFEB8",
            "#99C7FF", "#2F74D0",
            "#AE70ED","#FE8BF0","#FFA8A8"];
        this.pensizesizes = [ 1,1.5,2,3,4,6,8,11,16];
        this.tmcolorwheelcolors = ["#FF0066" ,"#00FF00", "#FFFF00","#FF3300","#6600FF","#FF99", "#FF","#FFFF"];


    };

    blackboard()
    {
        if (this.props.notepad && this.props.notepad.blackboard) return this.props.notepad.blackboard.current;
    }

    scrollheight()
    {
        return this.props.bbheight/this.props.bbwidth;
    }

    componentDidMount() // select defaults after mount
    {
        this.selectColor(3,this.tmcolorwheelcolors[2],20);
        this.selectColor(2,this.colorwheelcolors[0],this.pensizesizes[2]);
        this.selectColor(1,this.colorwheelcolors[0],10);        

        if (this.blackboard()) this.blackboard().setPenTool(this.colorwheelcolors[0],this.pensizesizes[2]);
    }

 


    addRemoveSecondToolGuardian(newguard)
    {
        if (this.secondtoolnum) clearTimeout(this.secondtoolnum);
        this.secondtoolnum=null;
        if (newguard) this.secondtoolnum=setTimeout((()=>(this.setState({secondtoolstep: 0} ))) , 3000);

    }



    selectTool(buttonid)
    {
        switch(buttonid) {
        case 3: 
            if (this.blackboard()) this.blackboard().setEraserTool(15); // was 30
            this.addRemoveSecondToolGuardian(false);    
         break;
        case 4: 
            if (this.blackboard()) this.blackboard().setMarkerTool(this.state.markercolor,20);
            this.addRemoveSecondToolGuardian(true);  
        break;
        case 5: 
            if (this.blackboard()) this.blackboard().setPenTool(this.state.pencolor,this.state.pensize);
            this.addRemoveSecondToolGuardian(true);   
        break;
        default:
            
        break;
        };

        this.setState((state)=>{
        var secondtoolstep=0;
        var newbuttonid=state.selectedButtonid;
        switch(buttonid) {
        case 3: 
            newbuttonid=buttonid;
        break;
        case 4: 
            secondtoolstep=1;
            newbuttonid=buttonid;
        break;
        case 5:
            newbuttonid=buttonid;
            if (buttonid===newbuttonid) secondtoolstep=(state.secondtoolstep) % 2+1;
            else secondtoolstep=1;
        break;
        default:
            secondtoolstep=0;
        break;
        };

        return {selectedButtonid:newbuttonid,secondtoolstep: secondtoolstep}});

    }

 

    selectColor(pickerid,color,size)
    {
        this.addRemoveSecondToolGuardian(true);
        switch (pickerid) {
        case 1: 
            this.setState({pencolor: color, selectedPickerid: pickerid});
             if (this.blackboard()) this.blackboard().setPenTool(color,this.state.pensize);
        break;
        case 2: 
            this.setState({pensize: size, selectedPickerid: pickerid});
            if (this.blackboard()) this.blackboard().setPenTool(this.state.pencolor,size);
        break;
        case 3: 
            this.setState({markercolor: color,selectedPickerid: pickerid});
            if (this.blackboard()) this.blackboard().setMarkerTool(color,20);
        break;
        default: break;
        };
    };

    scrollboardSetReference()
    {
        var scrollref=this.blackboard().getStartScrollboardTB();
        this.setState((state)=>{return {scrollboardreference: scrollref,
            scrolltoolposref: this.state.posy
        }  });
     
    };

    scrollboard(scrollx,scrolly)
    {
        let newposy=this.state.scrolltoolposref-scrolly/this.props.bbwidth; // well we have to check if it will be relocated
        if (newposy>0.9*this.scrollheight() || newposy<0.10*this.scrollheight())
            newposy=0.5*this.scrollheight();
        this.setState({posy:  newposy});
        if (this.blackboard()) this.blackboard().scrollboardTB(scrollx/this.props.bbwidth,scrolly/this.props.bbwidth,this.state.scrollboardreference);
    };

  

    reportDrawPos(x,y)
    {
        let now=Date.now();
        let elapsed=Math.min(now-this.lastpostime,100);
        this.lastpostime=now;


        let finaly=0;
        // ok the idea as as follows, if drawing is close, the toolbox is in an circle around the drawing
        let circlerad=0.2;
        //now we try to figure out if the circle and the line are intersecting
        let d=this.tbx-x;
        

        let scrollheight=this.scrollheight();

        this.setState((state)=>{

            if (d*d>circlerad*circlerad)
            {
            
                // no intersection
                finaly=Math.max(Math.min(0.9*scrollheight,y),0.1*scrollheight);
                //console.log("stupid  finaly",finaly,d,circlerad);
            } else {
                
                let finaly1=y+Math.sqrt(circlerad*circlerad-d*d);
                let finaly2=y-Math.sqrt(circlerad*circlerad-d*d);
                let ofinaly;

                if (Math.abs(finaly1-state.posy)< Math.abs(finaly2-state.posy)) {
                    finaly=finaly1;
                    ofinaly=finaly2;
                } else {
                    finaly=finaly2;
                    ofinaly=finaly1;
                }

            // console.log("first finaly",finaly);
                if (finaly<0.1*scrollheight || finaly>0.9*scrollheight ){ // in this case take the otherone

                // ok we move outside, jump
                finaly=ofinaly;
                
             //   console.log("second finaly",finaly);
                }
            }   

            let timefac=Math.min(elapsed/1000,1.0);
            //console.log("reportDrawPos", timefac, this.state.posy,finaly);

            let desty=state.posy*(1-timefac)+timefac*finaly;
            if (Math.abs(desty-y)<Math.abs(finaly-y) ) {
                // in this case jump
                desty=finaly;
            }

            return {posy: desty};});
        

     
    };

    endButtonPressed()
    {
        this.blackboard().endButtonPressed();
        this.setState({activated: false});
    };

    pictButtonPressed()
    {
        this.blackboard().pictButtonPressed();
        
        this.setState({activated: false});
        
    };

    reactivate(){
        console.log("reactivate");
         this.setState({activated: true});
    };


    render()
    {
   

        // move to state ?
       

        var maintools=[];

        var endbutton = <EndButton toolbox={this} buttonid={1} key={1} selected={this.state.selectedButtonid===1}/>;
        maintools.push(endbutton);

        var pictbutton = <PictButton toolbox={this} buttonid={6} key={6} selected={this.state.selectedButtonid===6}/>;
        maintools.push(pictbutton);

        var scrollbutton = <ScrollButton toolbox={this} buttonid={2} key={2} selected={this.state.selectedButtonid===2}/>;
        maintools.push(scrollbutton);

        var eraserbutton = <DrawFilledButton toolbox={this} buttonid={3} key={3} color={"#000000"} alpha={1.} marker={true} selected={this.state.selectedButtonid===3}/>;
        maintools.push(eraserbutton);

        var markerbutton = <DrawFilledButton toolbox={this} buttonid={4} key={4} color={this.state.markercolor} alpha={0.5} marker={true} selected={this.state.selectedButtonid===4}/>;
        maintools.push(markerbutton);
        var penbutton = <DrawFilledButton toolbox={this} buttonid={5} key={5} color={this.state.pencolor} alpha={1.0} marker={false} selected={this.state.selectedButtonid===5}/>;
        maintools.push(penbutton);

        maintools=maintools.map( (ele,it)=> <CircleElement radius={45} id={it} key={it} cpos={1} clength={maintools.length}> {ele}</CircleElement>)


        //maintools.arrangeButtons();



        
        
        
        

    
        var cwheelcpos=0;
        var pswheelcpos=0;
        if (this.state.selectedButtonid===5) {
            if (this.state.secondtoolstep===1) {
                cwheelcpos=1.;
            } else if (this.state.secondtoolstep===2) {
                pswheelcpos=1.;
            } 
        }
        var tmcwheelpcpos=0;
        if (this.state.selectedButtonid===4) {
            if (this.state.secondtoolstep===1) {
                tmcwheelpcpos=1;
            }
        }




        var colorwheel = [];
        //this.addChild(this.colorwheel);
  
        let it=0;
        for (it=0;it<this.colorwheelcolors.length;it++) {
            let newcolorbutton= <CircleElement radius={85} id={it} key={it}  cpos={cwheelcpos} clength={this.colorwheelcolors.length}>
            <ColorPickerButton toolbox={this} color={this.colorwheelcolors[it]} pickerid={1} size={20} sizefac={1} alpha={1} key={it} 
            selected={this.state.pencolor===this.colorwheelcolors[it]}/></CircleElement>;
            colorwheel.push(newcolorbutton);
        }

        //this.colorwheel.arrangeButtons();
        


        var pensizewheel = [];
        
        for (it=0;it<this.pensizesizes.length;it++) {
            let newcolorbutton= <CircleElement radius={85+16*0.001*this.props.bbwidth} cpos={pswheelcpos} id={it} key={it}  clength={this.pensizesizes.length}>
                                <ColorPickerButton toolbox={this} color={"#ffffff"} pickerid={2}  selected={this.state.pensize===this.pensizesizes[it]}
                                        size={this.pensizesizes[it]*0.001*this.props.bbwidth} mysize={this.pensizesizes[it]} sizefac={1/this.state.scalefac} alpha={1} key={it}/></CircleElement>;
            
            pensizewheel.push(newcolorbutton);
        }

        //this.pensizewheel.arrangeButtons();



        var tmcolorwheel = [];
        
        
        for (it=0;it<this.tmcolorwheelcolors.length;it++) {
            let newcolorbutton=<CircleElement radius={88} cpos={tmcwheelpcpos} id={it} key={it}  clength={this.tmcolorwheelcolors.length}>
             <ColorPickerButton toolbox={this} color={this.tmcolorwheelcolors[it]} pickerid={3} size={20} sizefac={1}  scalefac={1} alpha={0.5} key={it} selected={this.state.markercolor===this.tmcolorwheelcolors[it]} /></CircleElement>;
            tmcolorwheel.push(newcolorbutton);
        }

        //this.tmcolorwheel.arrangeButtons();
      //  this.tmcolorwheel.filters = [this.BloomFilter];
 
        

       
        return   <div style={{position:"absolute", top: this.state.posy*this.props.bbwidth+"px", left: this.tbx*this.props.bbwidth+"px", zIndex: 200}} >
            { this.state.activated && <Fragment> 
                <CircleWrap radius={85}  cpos={cwheelcpos} >
             {colorwheel} 
             </CircleWrap>
             <CircleWrap radius={85+16*0.001*this.props.bbwidth}  cpos={pswheelcpos} >
         {pensizewheel}
         </CircleWrap>
         <CircleWrap radius={88}  cpos={tmcwheelpcpos} >
        {tmcolorwheel}
        </CircleWrap>
        <CircleWrap radius={45} cpos={1} >
             {maintools}
             </CircleWrap>
             </Fragment>
            }
        </div>
        
    };
};


 export class   ConfirmBox extends Component {
    constructor(props)
    {
        super(props);

        this.state={activated: false};


        this.state.posx=0;
        this.state.posy=0;
       

    };

    blackboard()
    {
        if (this.props.notepad && this.props.notepad.blackboard) return this.props.notepad.blackboard.current;
    }

  

/*
    shutdown(){
        console.log("shutdown confirmbox");
        this.stage.removeChild(this);
        this.destroy(true);
    };*/

    /*
    updateGraphics(timestamp)
    {
        // figure out passed time
        var time = timestamp;//performance.now();
        var timestep = time-this.lastUpdateTime ;
        this.lastUpdateTime = time;

        if (this.buttons) this.buttons.timeStep(timestep);


    };*/

    reactivate(position){
        this.setState({posx: position.x, posy: position.y , activated: true});
        
    };

    okButtonPressed()
    {
        this.blackboard().okButtonPressed();
        this.setState({activated: false});
        

    };

    cancelButtonPressed()
    {
        this.blackboard().cancelButtonPressed();
        this.setState({activated: false});
    };

    render() {
        var okcancel=[];

        var okbutton = <OkButton toolbox={this} key={1} />;
        okcancel.push(okbutton);

        var cancelbutton =   <CancelButton toolbox={this} key={2} />;
        okcancel.push(cancelbutton);

        okcancel=okcancel.map( (ele,it)=> <CircleElement radius={20} id={it} key={it} cpos={1} clength={okcancel.length}> {ele}</CircleElement>)



        return   <div style={{position:"absolute", top: this.state.posy*this.props.bbwidth+"px", left: this.state.posx*this.props.bbwidth+"px", zIndex: 200}} >
        { this.state.activated && <Fragment>  
        <CircleWrap radius={20} cpos={1} >
         {okcancel}
         </CircleWrap>
         </Fragment>
        }
    </div>
    }
};






