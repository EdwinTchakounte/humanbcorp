var labelType, useGradients, nativeTextSupport, animate;
var voteClicked = false;


$(function () {
        
	init();
	$( document ).tooltip();
});




function setThemeId( theme_id )
{
    
	$('#theme_id').val(theme_id);


}


function setQuizzId( quizz_id )
{
    
	$('#quizz_id').val(quizz_id);
}









function setQuestionValue(question_id, pCase)
{

  
  url = "/lessonapp/question/ajax_get_question_activities/"+ question_id;
	$.getJSON(url, function(data) {

        if( data != null && data.length > 0 ) 
         {

		$('#selectActivity').empty();
		       	
	          $.each(data, function(key, value) {   
	
			 activityLine  = '<div id="select_activity_'+ data[key]["id"] + '" style="width:100%; height:40px;" >'; 
			 activityLine += '<input type="hidden" id="question_points_' + data[key]["id"] + '" value="' + data[key]["points"] + '" />';
			 activityLine += '<input type="hidden" id="question_number_' + data[key]["id"] + '" value="' + data[key]["number"] + '" />';
			 activityLine += '<input type="hidden" id="case_' + data[key]["id"] + '" value="' + pCase +'" />';
			 activityLine += '<input type="hidden" id="question_' + data[key]["id"] + '" value="' + question_id + '" />';

			 activityLine += '<span class="" style="float:left; padding:5px; font-size:20px; color:black;" id="select_text_' + data[key]["id"] + '">' + data[key]["title"] + '</span>';
			 
		
			 activityLine += '<button type="button" style="float:right; margin-left:5px;" id="select_addActivityButton_'+ data[key]["id"]  +'" class="btn btn-brand bx bx-plus-circle" style="">  </button>';
			 
			 activityLine  += '</div>'; 
			
	            
			$('#selectActivity').append(activityLine);
			if( pCase == 1 ) 
			{
		        	$('#select_addActivityButton_' + data[key]["id"]).click(updatePointsClick);
		               $('#update_value_title').text("Update Points");
		               $('#label_value_title').text("New Points: ");
		        }
		        else
		        {
		         	$('#select_addActivityButton_' + data[key]["id"]).click(updateNumberClick);
		         	$('#update_value_title').text("Update Number");
		         	$('#label_value_title').text("New Number: ");
		        }
		        
		        $('#form_case').val(pCase);	
		        
		        $('#select_activity_'+ data[key]['id']).mouseenter(function() {
		        
		               $('#select_activity_'+ data[key]['id']).css("background-color","var(--brand)");
		               $('#select_text_'+ data[key]['id']).css("color","#fff");
		               $('#select_addActivityButton_' + data[key]["id"]).css("background-color","#fff");
		               $('#select_addActivityButton_' + data[key]["id"]).css("color","var(--brand)");
		             
		        	
		        });
		        
		         $('#select_activity_'+ data[key]['id']).mouseleave(function() {
		        	
		        	
		               	$('#select_activity_'+ data[key]['id']).css("background-color","#EDF2F4");
		                       $('#select_text_'+ data[key]['id']).css("color","black");
		                       $('#select_addActivityButton_'+ data[key]['id']).css("background-color","var(--brand)");
		               	$('#select_addActivityButton_'+ data[key]['id']).css("color","#fff");
		        	
		        });
		        
		        
		          
		         
		        		         });  
		          

		          $('#selectActivity').show();
		          
	}
		          
                });

}


function updatePointsClick(eventObject) 
{ 

   //activity_id = eventObject.currentTarget.id.substr(16);
   divObj = $('#' + eventObject.currentTarget.id).parent();
   parentId = divObj.attr('id');
   activity_id = parentId.substr(16);

    var points = $('#question_points_' + activity_id).val();
    var question_id = $('#question_' + activity_id).val();
    $('#new_value').val(points);
    $('#form_question_id').val(question_id);
    $('#form_activity_id').val(activity_id);
    $('#make-new-value').show();
 
   return false;
 }
 
 
function updateNumberClick(eventObject) 
{ 

   //activity_id = eventObject.currentTarget.id.substr(16);
   divObj = $('#' + eventObject.currentTarget.id).parent();
   parentId = divObj.attr('id');
   activity_id = parentId.substr(16);

    var number = $('#question_number_' + activity_id).val();
    var question_id = $('#question_' + activity_id).val();
    $('#new_value').val(number);
    $('#form_question_id').val(question_id);
    $('#form_activity_id').val(activity_id);
    $('#make-new-value').show();
 
   return false;
 }
 
 






(function() {
   

  var ua = navigator.userAgent,
      iStuff = ua.match(/iPhone/i) || ua.match(/iPad/i),
      typeOfCanvas = typeof HTMLCanvasElement,
      nativeCanvasSupport = (typeOfCanvas == 'object' || typeOfCanvas == 'function'),
      textSupport = nativeCanvasSupport 
        && (typeof document.createElement('canvas').getContext('2d').fillText == 'function');
  //I'm setting this based on the fact that ExCanvas provides text support for IE
  //and that as of today iPhone/iPad current text support is lame
  labelType = (!nativeCanvasSupport || (textSupport && !iStuff))? 'Native' : 'HTML';
  nativeTextSupport = labelType == 'Native';
  useGradients = nativeCanvasSupport;
  animate = !(iStuff || !nativeCanvasSupport);
})();

var Log = {
  elem: false,
  write: function(text){
    if (!this.elem) 
      this.elem = document.getElementById('log');
    this.elem.innerHTML = text;
    this.elem.style.left = (500 - this.elem.offsetWidth / 2) + 'px';
  }
};


function voteUp(relationId){
	voteClicked = true;
	$.getJSON(""+ relationId, function(data)
	{
		
	});
	var imgId = "img-voteUp-"+ relationId;
	$jit.id(imgId).style.visibility = 'hidden'; 
}
function voteDown(relationId){
	voteClicked = true;
	$.getJSON(""+ relationId, function(data)
	{
		
	});
	var imgId = "img-voteDown-"+ relationId;
	$jit.id(imgId).style.visibility = 'hidden'; 
}

function init(){
   
    var getTree = (function() { 
		return function(nodeId, level, onComplete) {
		 
		
		    	if( $('#treeType').val() == 1 )
		    	{
				$.getJSON("/relations/publication/"+ nodeId.substr(4), function(data)
				{
						var newNode = data.children;
						var ans = {"id" : nodeId, 'children' : newNode};
						onComplete.onComplete(nodeId, ans);
				}); 
		    	}
		    	else
		    	{
		    		if( nodeId.slice(5,13) == "sequence" )
				{
					$.getJSON("/lessonapp/sequence/getChilds/"+nodeId.substr(14), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				}
				else if( nodeId.slice(5,10) == "theme" )
				{
				       
					$.getJSON("/lessonapp/theme/getChilds/"+nodeId.substr(11), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,11) == "examen" )
				{
				       
					$.getJSON("/lessonapp/examen/getChilds/"+nodeId.substr(12), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,11) == "seance" )
				{
				       
					$.getJSON("/lessonapp/seance/getChilds/"+nodeId.substr(12), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,13) == "objectif" )
				{
				       
					$.getJSON("/lessonapp/objectif/getChilds/"+nodeId.substr(14), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,13) == "activity" )
				{
				       
					$.getJSON("/lessonapp/activity/getChilds/"+nodeId.substr(14), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,12) == "control" )
				{
				       
					$.getJSON("/lessonapp/control/getChilds/"+nodeId.substr(13), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,14) == "component" )
				{

				       
					$.getJSON("/lessonapp/component/getChilds/"+nodeId.substr(15), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}	
								
				else if( nodeId.slice(5,9) == "file" )
				{
				       
					$.getJSON("/lessonapp/file/getChilds/"+nodeId.substr(10), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,17) == "responsefile" )
				{
				       
					$.getJSON("/lessonapp/response_file/getChilds/"+nodeId.substr(18), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,27) == "responsecorrectionfile" )
				{
				       
					$.getJSON("/lessonapp/response_correction_file/getChilds/"+nodeId.substr(28), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,9) == "link" )
				{
				       
					$.getJSON("/lessonapp/link/getChilds/"+nodeId.substr(10), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				
				else if( nodeId.slice(5,13) == "question" )
				{
				       
					$.getJSON("/lessonapp/question/getChilds/"+nodeId.substr(14), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,13) == "checkbox" )
				{
				       
					$.getJSON("/lessonapp/checkbox/getChilds/"+nodeId.substr(14), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				else if( nodeId.slice(5,10) == "radio" )
				{
				       
					$.getJSON("/lessonapp/radio/getChilds/"+nodeId.substr(11), function(data)
					{
							var newNode = data.children;
							var ans = {"id" : nodeId, 'children' : newNode};
							onComplete.onComplete(nodeId, ans);
					});
				
				
				}
				
				
				
				
		    	
		    	
		    	
		    	}
		};
	})();
	
    //init Spacetree
    //Create a new ST instance
    var st = new $jit.ST({
        'injectInto': 'infovis',
        
          // set orientation 
        //orientation: 'top',
        
        //set duration for the animation
        duration: 400,
        
        //set animation transition type
        transition: $jit.Trans.Quart.easeInOut,
        //set distance between node and its children
        levelDistance: 50,
        
        // infinite number of levels to show.
        //constrained: false,
        //levelsToShow: 100,

        //set max levels to show. Useful when used with
        //the request method for requesting trees of specific depth
        levelsToShow: 1,
        //set node and edge styles
        //set overridable=true for styling individual
        //nodes or edges
        Node: {
            height: 130,
            width: 190,
            type: 'rectangle',
            color:'#DAD7CD',
            lineWidth: 5,
            align:"center",
            overridable: true
        },
		
		Label: {  
			overridable: true,  
			type: 'HTML', //'SVG', 'Native'  
			size: 8,  
			family: 'sans-serif',  
			textAlign: 'center',  
			textBaseline: 'alphabetic',  
			color: '#fff'  
		},  
	
        Edge: {
            type: 'bezier',
            lineWidth: 1,
            color:'#000000',
            overridable: true
        },
        
        //Add a request method for requesting on-demand json trees. 
        //This method gets called when a node
        //is clicked and its subtree has a smaller depth
        //than the one specified by the levelsToShow parameter.
        //In that case a subtree is requested and is added to the dataset.
        //This method is asynchronous, so you can make an Ajax request for that
        //subtree and then handle it to the onComplete callback.
        //Here we just use a client-side tree generator (the getTree function).
        request: function(nodeId, level, onComplete) {
			var ans = getTree(nodeId, level, onComplete);
        },
        
        onBeforeCompute: function(node){
            Log.write("loading " + node.name);
        },
        
        onAfterCompute: function(){
            Log.write("done");
        },
        
        //This method is called on DOM label creation.
        //Use this method to add event handlers and styles to
        //your node.
        onCreateLabel: function(label, node){
            label.id = node.id;
            label.title = node.name;  
                 
            if( label.title.length > 20 )  
            {   
               
                if( label.id.slice(5,13) == "sequence" )
                {
            		label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:var(--brand);'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,10) == "theme" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:15px; background-color:#fff; color:#78290F;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,11) == "examen" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#582F0E; color:black;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,13) == "objectif" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#CA6702;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,11) == "seance" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#F35B04;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,13) == "activity" )
            	 {
            	 	label.innerHTML = "<div style='height:40px; margin-bottom:2px; background-color:#fff; color:#590D22;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	  else  if( label.id.slice(5,12) == "control" )
            	 {
            	 	label.innerHTML = "<div style='height:40px; margin-bottom:2px; background-color:#fff; color:#023047;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,14) == "component" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#D90429;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,9) == "file" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#DAD7CD; color:black;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,17) == "responsefile" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#FCA311; color:black;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,27) == "responsecorrectionfile" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#D4A373; color:black;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,9) == "link" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#DAD7CD; color:black;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	
            	 else  if( label.id.slice(5,13) == "question" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:15px; background-color:#fff; color:#3D2C2E;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,13) == "checkbox" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#A63446;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else  if( label.id.slice(5,10) == "radio" )
            	 {
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#710000;'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	 else
            	 {
            	    label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:var(--brand);'>"+ node.name.substring(0, 35) + "..."   +"</div>"; 
            	 }
            	
            	 
            	    
            }
            else
            {
               
            	if( label.id.slice(5,13) == "sequence" )
            	{
            		label.innerHTML = "<div style='height:50px;  margin-bottom:5px; background-color:#fff; color:var(--brand);'>"+ label.title   +"</div>"; 
            	}
            	else  if( label.id.slice(5,10) == "theme" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:15px; background-color:#fff; color:#78290F;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,11) == "examen" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#582F0E;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,13) == "objectif" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#CA6702;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,11) == "seance" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#F35B04;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,13) == "activity" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:40px; margin-bottom:2px; background-color:#fff; color:#590D22;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,12) == "control" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:40px; margin-bottom:2px; background-color:#fff; color:#023047;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,14) == "component" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#D90429;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,9) == "file" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#DAD7CD; color:black;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,17) == "responsefile" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#FCA311; color:black;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,27) == "responsecorrectionfile" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#D4A373; color:black;'>"+ label.title +"</div>"; 
            	
            	}

            	else  if( label.id.slice(5,9) == "link" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#DAD7CD; color:black;'>"+ label.title +"</div>"; 
            	
            	}
            	
            	else  if( label.id.slice(5,13) == "question" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:15px; background-color:#fff; color:#3D2C2E;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,13) == "checkbox" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#A63446;'>"+ label.title +"</div>"; 
            	
            	}
            	else  if( label.id.slice(5,10) == "radio" )
            	{
            	     
            	 	label.innerHTML = "<div style='height:50px; margin-bottom:5px; background-color:#fff; color:#710000;'>"+ label.title +"</div>"; 
            	
            	}
            	
            	else 
            	{
            	     
            	  label.innerHTML = "<div style='height:50px;  margin-bottom:5px; background-color:#fff; color:var(--brand);'>"+ label.title   +"</div>"; 
            	
            	}
            }
            
            
            
         if( $('#treeType').val() == 1 ) 
         { 
            	
            		label.innerHTML += "<br/>"
			if(node.data.relationId != null)
			{
				label.innerHTML += "<div style='background-color:#fff; margin-top:-25px;' class='container'><a data-controls-modal='modal-voteup' data-backdrop='true' data-keyboard='true' href='#' onClick='voteUp("+ node.data.relationId +")'  style='color:var(--brand);'   alt='Vote this relation up'><i class='bx bxs-message' id='img-voteUp-"+ node.data.relationId +"'> </i></a></div>";
				if(node.data.relationWeight > 1)
				 {
					label.innerHTML += "<a data-controls-modal='modal-voteup' data-backdrop='true' data-keyboard='true' href='#' onClick='voteDown("+ node.data.relationId +")' class='' style='color:var(--brand); margin-left:4px;' alt='Vote this relation down'><i class='bx bxs-message' id='img-voteDown-"+ node.data.relationId +"'> </i></a>";		
				}
			}
			
			
              if(!node.data.is_private)
              {
	label.innerHTML += "<a href='/publications/"+ node.id.substr(4) +"' class='container'  style='color:#fff; margin:2px; padding:4px; width:90%; background-color:var(--brand); text-decoration:none;  text-align:center; border-radius:5px;'>Show</a>";
	      }
	     		
			
	}
	else
	{    
	
		       if( label.id.slice(5,13) == "sequence" )
                       {
                        
                             label.innerHTML += "<a href='/lessonapp/examen/create/"+ node.id.substr(14) +"'  class='container'  style='color:#fff; margin:2px; padding:4px; width:90%; background-color:var(--brand); text-decoration:none;  text-align:center; border-radius:5px;' alt='Add new Examen'><i class='bx bx-folder-plus' id='img-add-examen"+ label.id +"'> </i>examen</a>";
                        
                            label.innerHTML += "<a  href='/lessonapp/theme/create/"+ node.id.substr(14) +"'  class='container'  style='color:#fff; margin:2px; padding:4px; width:90%; background-color:var(--brand); text-decoration:none;  text-align:center; border-radius:5px;' alt='Vote this relation up'><i class='bx bx-folder-plus' id='img-add-theme"+ label.id +"'> </i>theme</a>";
                            
                           
                       
                       }
                       else  if( label.id.slice(5,10) == "theme" )
                       {
                        
                            label.innerHTML += "<a data-bs-toggle='modal' data-bs-target='#modal-add-objectif-link'  href='#' onClick='setThemeId("+ node.id.substr(11) +")' class='container'  style='background-color:#78290F; color:#fff; margin:2px;  padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none;' alt='Add new Objectif'><i class='bx bx-folder-plus' id='img-add-objectif"+ label.id +"'> </i>objectif</a>";
                            
                                  label.innerHTML += "<a href='/lessonapp/seance/create/"+ node.id.substr(11) +"/"+ $('#sequenceId').val()  +"' class='container'  style='background-color:#78290F; color:#fff; margin:2px;  padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none;' alt='Add new Seance'><i class='bx bx-folder-plus' id='img-add-seance"+ label.id +"'> </i>seance</a>";
                       
                              
                             label.innerHTML += "<a  href='#' onClick=''  style='display:none; color:#fff; float:left; margin-left:4px;' alt=''><i class='bx bx-folder-plus' id='img-add-classe"+ label.id +"'> </i>edit</a>";
                            
                             
                         
                       }
                       else  if( label.id.slice(5,11) == "examen" )
                       {
                        
                            label.innerHTML += "<a data-bs-toggle='modal' data-bs-target='#modal-add-objectif-link'  href='#' onClick='setThemeId("+ node.id.substr(12) +")' class='container' style='background-color:#582F0E; color:#fff; margin:2px;  padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none;' alt='Add new Obectif'><i class='bx bx-folder-plus' id='img-add-objectif"+ label.id +"'> </i>objectif</a>";
                            
                                  label.innerHTML += "<a href='/lessonapp/seance/create/"+ node.id.substr(12) +"/"+ $('#sequenceId').val()  +"'  style='background-color:#582F0E; color:#fff; margin:2px;  padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none;' alt='Add new Seance'><i class='bx bx-folder-plus' id='img-add-seance"+ label.id +"'> </i>seance</a>";
                       
                              
                             label.innerHTML += "<a  href='#' onClick=''  style='display:none; color:#fff; float:left; margin-left:4px;' alt=''><i class='bx bx-folder-plus' id='img-add-classe"+ label.id +"'> </i>edit</a>";
                            
                             
                         
                       }
                       else  if( label.id.slice(5,11) == "seance" )
                       {
                       
                            
                       	 label.innerHTML += "<a href='/lessonapp/activity/create/"+ node.id.substr(12) +"/"+ node.data["theme_id"] +"/"+ $('#sequenceId').val()  +"' class='container' style='background-color:#F35B04; color:#fff; margin:2px;  padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none; ' alt='Add new Activity'><i class='bx bx-folder-plus' id='img-add-activity"+ label.id +"'> </i> Activity </a>";
                       	 
                        label.innerHTML += "<a href='/lessonapp/control/create/"+ node.id.substr(12) +"/"+ node.data["theme_id"] +"/"+ $('#sequenceId').val()  +"' class='container' style='background-color:#F35B04; color:#fff; margin:2px;  padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none; ' alt='Add new Activity'><i class='bx bx-folder-plus' id='img-add-activity"+ label.id +"'> </i> Control </a>";
                       	 
                        label.innerHTML += "<a  href='/lessonapp/file/create/0/"+ node.id.substr(12)  +"/"+ node.data["theme_id"] +"/"+ $('#sequenceId').val() +"/"+ 51 +"' onClick=''  style='color:#F35B04; float:left; margin-left:4px;' alt='Add new file'><i class='bx bx-folder-plus' id='img-add-file"+ label.id +"'> </i>file</a>";
                       
                       
                       label.innerHTML += "<br/><a  href='/lessonapp/link/create/0/"+ node.id.substr(12) +"/"+ node.data["theme_id"] +"/"+ $('#sequenceId').val()  +"/"+ 51 +"' onClick=''  style='color:#F35B04; float:left; margin-left:4px;' alt=''><i class='bx bx-folder-plus' id='img-add-classe"+ label.id +"'> </i> link </a>";
                       
                             
                       }
                       else if( label.id.slice(5,13) == "activity" )
                       {
                                label.innerHTML += "<a  href='/lessonapp/file/create/"+ node.id.substr(14) +"/"+ node.data["seance_id"]   +"/"+ node.data["theme_id"] +"/"+ $('#sequenceId').val() +"/"+ 21 +"' onClick=''  style='color:#590D22; float:left; margin-left:4px;' alt='Add new file'><i class='bx bx-folder-plus' id='img-add-file"+ label.id +"'> </i>file</a>";
                            
                             
                             
                       	 label.innerHTML += "<a  href='/lessonapp/question/create/"+ node.id.substr(14) +"/"+ node.data["seance_id"] +"/"+  node.data["theme_id"] +"/"+ $('#sequenceId').val() +"' onClick='' class='container'  style='background-color:#590D22; color:#fff; margin:2px; padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none;' alt='Add new question'><i class='bx bx-folder-plus' id='img-add-question"+ label.id +"'> </i> Question </a>";
                       
                       
                         label.innerHTML += "<br/><a  href='/lessonapp/link/create/"+ node.id.substr(14) +"/"+ node.data["seance_id"]  +"/"+ node.data["theme_id"] +"/"+ $('#sequenceId').val()  +"/"+ 21 +"' onClick=''  style='color:#590D22; float:left; margin-left:4px;' alt=''><i class='bx bx-folder-plus' id='img-add-classe"+ label.id +"'> </i> link </a>";
                         
                         
                          label.innerHTML += "<br/><a  href='/lessonapp/component/create/"+ node.id.substr(14) +"/"+ node.data["seance_id"]  +"/"+ node.data["theme_id"] +"/2/"+ $('#sequenceId').val()  +"' onClick=''  style='color:#590D22; float:left; margin-left:4px;' alt=''><i class='bx bx-folder-plus' id='img-add-classe"+ label.id +"'> </i> para </a>";
                          
                          label.innerHTML += "<a  href='/lessonapp/component/create/"+ node.id.substr(14) +"/"+ node.data["seance_id"]  +"/"+ node.data["theme_id"] +"/3/"+ $('#sequenceId').val()  +"' onClick=''  style='color:#590D22; float:left; margin-left:4px;' alt=''> img </a>";
                          
                          label.innerHTML += "<a  href='/lessonapp/component/create/"+ node.id.substr(14) +"/"+ node.data["seance_id"]  +"/"+ node.data["theme_id"] +"/1/"+ $('#sequenceId').val()  +"' onClick=''  style='color:#590D22; float:left; margin-left:4px;' alt=''> titre </a>";
                         
                         
                         
                       
                       } 
                         else if( label.id.slice(5,12) == "control" )
                       {
                                label.innerHTML += "<a  href='/lessonapp/file/create/"+ node.id.substr(13) +"/"+ node.data["seance_id"]   +"/"+ node.data["theme_id"] +"/"+ $('#sequenceId').val() +"/"+ 21 +"' onClick=''  style='color:#023047; float:left; margin-left:4px;' alt='Add new file'><i class='bx bx-folder-plus' id='img-add-file"+ label.id +"'> </i>file</a>";
                            
                             
                             
                       	 label.innerHTML += "<a  href='/lessonapp/question/create/"+ node.id.substr(13) +"/"+ node.data["seance_id"] +"/"+  node.data["theme_id"] +"/"+ $('#sequenceId').val() +"' onClick='' class='container'  style='background-color:#023047; color:#fff; margin:2px;  padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none;' alt='Add new question'><i class='bx bx-folder-plus' id='img-add-question"+ label.id +"'> </i> Question </a>";
                       
                       
                         label.innerHTML += "<br/><a  href='/lessonapp/link/create/"+ node.id.substr(13) +"/"+ node.data["seance_id"]  +"/"+ node.data["theme_id"] +"/"+ $('#sequenceId').val()  +"' onClick=''  style='color:#023047; float:left; margin-left:4px;' alt=''><i class='bx bx-folder-plus' id='img-add-classe"+ label.id +"'> </i> link </a>";
                         
                         
                          label.innerHTML += "<br/><a  href='/lessonapp/component/create/"+ node.id.substr(13) +"/"+ node.data["seance_id"]  +"/"+ node.data["theme_id"] +"/2/"+ $('#sequenceId').val()  +"' onClick=''  style='color:#023047; float:left; margin-left:4px;' alt=''><i class='bx bx-folder-plus' id='img-add-classe"+ label.id +"'> </i> para </a>";
                          
                          label.innerHTML += "<a  href='/lessonapp/component/create/"+ node.id.substr(13) +"/"+ node.data["seance_id"]  +"/"+ node.data["theme_id"] +"/3/"+ $('#sequenceId').val()  +"' onClick=''  style='color:#023047; float:left; margin-left:4px;' alt=''> img </a>";
                          
                          label.innerHTML += "<a  href='/lessonapp/component/create/"+ node.id.substr(13) +"/"+ node.data["seance_id"]  +"/"+ node.data["theme_id"] +"/1/"+ $('#sequenceId').val()  +"' onClick=''  style='color:#023047; float:left; margin-left:4px;' alt=''> titre </a>";
                         
                         
                         
                       
                       }
                       else if( label.id.slice(5,9) == "file" )
                       {
                             
                       	if( node.data["m_type"] == 2 )
                       	{
                       		 label.innerHTML += "<a  href='/lessonapp/file/create/"+ node.id.substr(10) +"/"+ node.data["seance_id"]   +"/"+ node.data["theme_id"] +"/"+ $('#sequenceId').val() +"/"+ 414 +"' onClick=''  style='color:#590D22; float:left; margin-left:4px;' alt='add correction file'><i class='bx bx-folder-plus' id='img-add-file"+ label.id +"'> </i>correction</a>";

                       	
                       	}
                       	
                       	 label.innerHTML += "<a  href="+ node.data["url"]   +" target='_blank' onClick=''  style='color:#590D22; float:rigth; margin-left:4px;' alt='show file'><i class='bx bx-folder-plus' id='img-add-file"+ label.id +"'> </i>show</a>";

                       
                       
                       }
                       else if( label.id.slice(5,17) == "responsefile" )
                       {
                       
                       	 label.innerHTML += "<a  href="+ node.data["url"]   +" target='_blank' onClick=''  style='color:#590D22; float:rigth; margin-left:4px;' alt='show file'><i class='bx bx-folder-plus' id='img-add-file"+ label.id +"'> </i>show</a>";

                       
                       }
                       else if( label.id.slice(5,27) == "responsecorrectionfile" )
                       {
                       
                       	 label.innerHTML += "<a  href="+ node.data["url"]   +" target='_blank' onClick=''  style='color:#590D22; float:rigth; margin-left:4px;' alt='show file'><i class='bx bx-folder-plus' id='img-add-file"+ label.id +"'> </i>show</a>";

                       
                       }
                       else if( label.id.slice(5,9) == "link" )
                       {
                             
                       	
                       
                       
                       }
                     
                       else  if( label.id.slice(5,13) == "question" )
                       {
                       
                       	 label.innerHTML += "<a href='/lessonapp/radio/create/"+ node.id.substr(14) +"/"+ $('#sequenceId').val()  +"' class='container' style='background-color:#3D2C2E; color:#fff; margin:2px;  padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none;' alt='Add new radio'><i class='bx bx-folder-plus' id='img-add-radio"+ label.id +"'> </i> radio </a>";
                            
                           
                            
                        label.innerHTML += "<a href='/lessonapp/checkbox/create/"+ node.id.substr(14) +"/"+  $('#sequenceId').val()  +"' class='container' style='background-color:#3D2C2E; color:#fff; margin:2px;  padding:4px; text-align:center; width:90%; border-radius:5px; text-decoration:none;' alt='Add new checkbox'><i class='bx bx-folder-plus' id='img-add-checkbox"+ label.id +"'> </i> checkbox </a>";
                       
                      	 
                      label.innerHTML += "<a data-bs-toggle='modal' data-bs-target='#modal-add-points-number-link'  href='#' onClick='setQuestionValue("+ node.id.substr(14) +", 1)' class=''  style='color:#3D2C2E; float:left; margin-left:12px;' alt='Add new points'><i class='bx bx-folder-plus' id='img-add-note"+ label.id +"'> </i>points</a>";
                      

                      
                        label.innerHTML += "<a data-bs-toggle='modal' data-bs-target='#modal-add-points-number-link'  href='#' onClick='setQuestionValue("+ node.id.substr(14) +", 2)' class=''  style='color:#3D2C2E; float:left; margin-left:25px;' alt='Add new number'><i class='bx bx-folder-plus' id='img-add-note"+ label.id +"'> </i>number</a>";
                       
                       
                    
                       }
                       else if( label.id.slice(5,13) == "checkbox" )
                       {
                             
                       	
                       
                       
                       }
                       else if( label.id.slice(5,10) == "radio" )
                       {
                             
                       	
                       
                       
                       }
                       
                       
                       
                     
		  
	
	
	}
			
			
			label.onclick = function(){
				if(!voteClicked){
					st.onClick(node.id);
				}
				voteClicked = false;
                        };
            
           
            //set label styles
            var style = label.style;
            style.width = 110 + 'px';
            style.height = 40 + 'px';            
            style.cursor = 'pointer';
            //style.backgroundColor = '#fff';
			//style.color = '#fff';
            //style.fontSize = '0.8em';
            style.textAlign= 'center';
            style.paddingTop = '0px';
        },
        
        //This method is called right before plotting
        //a node. It's useful for changing an individual node
        //style properties before plotting it.
        //The data properties prefixed with a dollar
        //sign will override the global node style properties.
        onBeforePlotNode: function(node){
        },
        
        //This method is called right before plotting
        //an edge. It's useful for changing an individual edge
        //style properties before plotting it.
        //Edge data proprties prefixed with a dollar sign will
        //override the Edge global style properties.
        onBeforePlotLine: function(adj){
			var lineWidth = adj.nodeTo.data.relationWeight;
			if(lineWidth > 10) {
				lineWidth = 10;
			}
			adj.data.$lineWidth = lineWidth;
			
			if(adj.nodeTo.data.relationWeight > 20) {
				adj.data.$color = "#f00";
			} else if(adj.nodeTo.data.relationWeight > 15) {
				adj.data.$color = "#ff0";			
			} else if(adj.nodeTo.data.relationWeight > 10) {
				adj.data.$color = "#0f0";			
			}

		}
    });
	
	
    //load json data
          var url;
	//var url = "/relations/publication/"+ window.location.href.substr(window.location.href.lastIndexOf('/')+1);
	if( $('#treeType').val() == 1 ) 
	{
		pubId = document.getElementById('pubId').value
		url = "/relations/publication/"+ pubId;
	}
	else
	{
	       
		sequenceId = document.getElementById('sequenceId').value
	        url = "/lessonapp/sequence/getChilds/"+ sequenceId;
	
	}
	var startTree = $.getJSON(url, function(json) { 
		st.loadJSON(json);
		//compute node positions and layout
		st.compute();
		//optional: make a translation of the tree
		//st.geom.translate(new $jit.Complex(-200, 0), "current");
		//emulate a click on the root node.
		st.onClick(st.root);
		//end
	});
	

}
