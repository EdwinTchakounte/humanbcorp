var getSpacesUrl;
var index = 0;
var allContentsInSpace = "";
var currentDiv = 0;

$(function () { 

   $('#detail1-button').click(function(){
	$('#detail1').show();
	$('#detail2').hide();
	$('#detail21').hide();
	$('#detail3').hide();
	$('#detail31').hide();
	$('#detail4').hide();
	$('#detail41').hide();
	$('#detail5').hide();
	$('#detail51').hide();
});

$('#detail2-button').click(function(){
	$('#detail2').show();
	$('#detail21').show();
	$('#detail1').hide();
	$('#detail3').hide();
	$('#detail31').hide();
	$('#detail4').hide();
	$('#detail41').hide();
	$('#detail5').hide();
	$('#detail51').hide();
});
$('#detail3-button').click(function(){
	$('#detail3').show();
	$('#detail31').show();
	$('#detail2').hide();
	$('#detail21').hide();
	$('#detail1').hide();
	$('#detail4').hide();
	$('#detail41').hide();
	$('#detail5').hide();
	$('#detail51').hide();
});

$('#detail4-button').click(function(){
	$('#detail4').show();
	$('#detail41').show();
	$('#detail2').hide();
	$('#detail21').hide();
	$('#detail3').hide();
	$('#detail31').hide();
	$('#detail1').hide();
	$('#detail5').hide();
	$('#detail51').hide();
});


$('#detail5-button').click(function(){
	$('#detail5').show();
	$('#detail51').show();
	$('#detail2').hide();
	$('#detail21').hide();
	$('#detail3').hide();
	$('#detail31').hide();
	$('#detail1').hide();
	$('#detail4').hide();
	$('#detail41').hide();
});

	 
	
	
});


function loadSessions()
{
	$('#container0').empty();
	$('#container1').empty();
	getContent(0, 1, true);
}


function update_meeting_link( m_id )
{
	$('#meeting_id_form').val(m_id);

}


function getContent(id, choice, reverse)
{
	if( choice == 1 ) 
	{
	      	  $.getJSON('/lessonapp/session/ajax_get_sessions_data/', function(data) {
     

		   
		     if( data != null && data.length != 0 ) 
		     {
				/* create title */
				 $('#sequence_theme').hide();
				 $('#sequence_title').hide();
				 $('#sequence_icon').hide();
				 $('#session_icon').hide();
				 $('#session_title').show();
				 
			       $('<hr />').appendTo('#container' + currentDiv);
			       /* create category list */
			       $('<ul />', {id: 'categoriesGrid' + currentDiv}).appendTo('#container' + currentDiv);
			       $.each(data, function(key, val) {
				 $('<li />', {
				   class: 'ui-state-default',
				   id:'session_'+ data[key]['id'],
				   text:data[key]['year']
				 }).appendTo('#categoriesGrid' + currentDiv);

				 /* add click event */
				 $('#session_' + data[key]['id']).click(function() {
				   slideTo($(this).attr('id').substr(8), 2, reverse );
				 });
			       });
		     }

		     /* show list */
		     $('#categoriesGrid' + currentDiv).show();
 		
 		        /* hide loader */
			 $('#loader').fadeOut('fast');
		
		   });
			      	
	      
	      
	}
	else if ( choice == 2 ) 
	{
	        
		  $.getJSON('/lessonapp/sequence/ajax_get_sequences_from_session_id/' + id, function(data) {
       
		     if( data != null && data.length != 0 ) 
		     {

		          /* create title */
			  $('#sequence_theme').hide();
			  $('#sequence_title').show();
		         $('#sequence_icon').hide();
		         $('#session_icon').show();
		         $('#session_title').show();
		         
		      
			       $('<hr />').appendTo('#container' + currentDiv);
			       /* create category list */
			       $('<ul />', {id: 'categoriesGrid' + currentDiv}).appendTo('#container' + currentDiv);
			       $.each(data, function(key, val) {
				 $('<li />', {
				   class: 'ui-state-default',
				   id: 'sequence_'+data[key]['id'],
				   text:"Sequence " + data[key]['numero'].toString()
				 }).appendTo('#categoriesGrid' + currentDiv);

				 /* add click event */
				 $('#sequence_' + data[key]['id']).click(function() {
				   
				   slideTo($(this).attr('id'), 3, reverse );
				 });
			       });
		     }

		     /* show list */
		     $('#categoriesGrid' + currentDiv).show();
 		
 		        /* hide loader */
			 $('#loader').fadeOut('fast');
		
		   });
	
	}
	else 
	{

 $.getJSON('/lessonapp/theme/ajax_get_themes_from_sequence_id' + ( (id.substr(9)) != null ? '/' + (id.substr(9)) : ''), function(data) {
			 if( data != null && data.length != 0 ) {
			   /* create title */
			  $('#sequence_theme').show();
			  $('#sequence_title').show();
		          $('#sequence_icon').show();
		          $('#session_icon').show();
		          $('#session_title').show();
		         
			   
			   $('<hr />').appendTo('#container' + currentDiv);
			   
			    $('<div />', {
			      id: 'classes_div',
			      class:'row',
			      style:'margin:5px;'
			     }).appendTo('#container' + currentDiv); 
			   
			     $.getJSON('/lessonapp/class/ajax_get_classes/', function(data_classes) {
			     
			     
			      	    loadClasses( data_classes, id.substr(9) );
			      	    
			      	    
			      
			      });
			  
			   
			 
			     
			 }

			 /* hide loader */
			 $('#loader').fadeOut('fast');
		       });
		    
	
	
	}
	


}






function slideTo(id, choice, reverse) {
  prevDiv    = currentDiv;
  currentDiv = (currentDiv + 1) % 2;

  /* show loader */
  $('#loader').fadeIn('fast');

  /* decide which direction to move */
  d1 = 'left'; d2 = 'right';
  if( reverse == true ) {
    d1 = 'right'; d2 = 'left';
  }

  /* clear containers */
  $('#container' + currentDiv).empty();
 // $('#container' + prevDiv).empty();

  
  /* update content */
  getContent(id,  choice, !reverse);
 
  /* slide-move */
  $('#container' + prevDiv).hide();
  $('#container' + prevDiv).empty();
   $('#container' + currentDiv).show();
  /*
  $('#container' + prevDiv).hide('drop', {direction: d1}, 200, function() {
    $('#container' + currentDiv).show('drop', {direction: d2}, 200);
     $('#container' + prevDiv).empty();
  });
  */
  

}



function addThemeClick(eventObject) 
{
   id = eventObject.currentTarget.id.substr(9);

   var url = '/lessonapp/read_theme/'+ id;
   var event_id =  $('#eventId').val();
   // bind theme with event
   const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    $.ajax({
		    url:'/calendarapp/save_event_theme/',
		    type: 'POST',
		    headers: {'X-CSRFToken': csrftoken},
		    data: {
		      'event_id': event_id,
		      'theme_id': id,
		      'link_url':url
		    },
		    success: function (data) 
		    {
		        if( data['success'] == true )
		        {
		       	window.location ='/calendarapp/event/details/' + event_id;
		        }
		       
		    }
	});      
 	
		     
  return false;
}


function loadThemes(classe_id, sequence_id)
{

     $.getJSON('/lessonapp/theme/ajax_get_themes/'+ sequence_id + '/' + classe_id + '/' , function(data) {
			     
	  if( data != null && data.length != 0 )
	  {	
	        $('#lessons_div').empty();
	        	     
		    
			   $('<ul />', {id: 'recipesList' + currentDiv}).appendTo('#lessons_div');
			   
content =  '<div id="theme" class="container" style="background-color:#fff; width:97%; margin:10px;" >';       
		
		
		content += '<table style="background-color:#efefef; width:97%; margin:10px;" class="bordered-table zebra-striped">';
		                    
			      		content +='<thead>';
						content +='<tr>';
						content +='<th> Theme </th>';
						content +='<th> Delete </th>';
						content +='</tr>';
					content +='</thead>';
					content +='<tbody>';
			   $.each(data, function(key, val) {
			   
	        content += '<input type="hidden" id="url_' + data[key]['id'] + '" value="/lessonapp/read_theme/'+ data[key]['id'] +'"/>';
		

						content +='<tr>';
						
							content +='<td><a   class="" href="/lessonapp/read_theme/'+ data[key]['id'] +'">'+ data[key]['title']  +'</a></td>';
						
							content +='<td><button type="button" id="addTheme_'+ data[key]['id'] +'"  class="btn btn-brand bx bx-plus-circle" style="height:30px;"></button></td>';
			      			
			      			content +='</tr>';
			      			
			      	
			   
			         
			       // $('#addTheme_' + data[key]['id']).click(addThemeClick);
				   
			     
			   });
			   
			content +='</tbody>';
		content +='</table>';

content +='</div>';   

	   $('#recipesList' + currentDiv).append(content);
	   $('[id^="addTheme_"]').click(addThemeClick);	         	   
	}	      	    
			      	    
			      
   });



}




function loadClasses(data_classes, sequence_id ){

  if( data_classes != null && data_classes.length != 0 )
  {
	 $('<ul />', {id: 'classesGrid' + currentDiv}).prependTo('#classes_div'); 

		 $.each(data_classes, function(key2, val2) {
					 
			 $('<li />', {
				class: 'ui-state-default',
				id: 'classe_'+ data_classes[key2]['id'],
			        text:"Classe " + data_classes[key2]['name'].toString()
			 }).appendTo('#classesGrid' + currentDiv);
			 
			 
			   /* add lessons_div   */
			   $('<div />', {
			      id: 'lessons_div',
			      class:'container',
			      style:'width:95%; margin-left:2%; text-align:center; overflow-y:scroll;'
			     }).appendTo('#container' + currentDiv);
			     
			 			  
			 
			  /* add click event */
			  $('#classe_'+ data_classes[key2]['id']).click(function() {
			        
			  
			          loadThemes($(this).attr('id').substr(7), sequence_id);
				 
			   });
			 
			 
				 
		 }); 
		   
		 
		 
		 
		
		 $('#classesGrid' + currentDiv).show();
  }




}







