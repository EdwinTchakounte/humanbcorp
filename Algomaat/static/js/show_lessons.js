var currentDiv = 0;

/* On Dom Ready */
$(function() {
  getContent(0, 1, true, "");
});

$(window).bind('popstate', function(event) {
  slideTo(event.originalEvent.state.id, true);
})

function getContent(id, choice, reverse, parentTitle)
{
	if( choice == 1 ) 
	{
	      	  $.getJSON('/lessonapp/session/ajax_get_sessions_data/', function(data) {
     

		   
		     if( data != null && data.length != 0 ) {
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
			   id: data[key]['id'],
			   text:data[key]['year']
			 }).appendTo('#categoriesGrid' + currentDiv);

			 /* add click event */
			 $('#' + data[key]['id']).click(function() {
			   slideTo($(this).attr('id'), 2, false, "Session" + data[key]['year'] );
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
     

		   
		     if( data != null && data.length != 0 ) {
		     
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
			   
			   slideTo($(this).attr('id'), 3, true, parentTitle + ">>" + $(this).attr('text') );
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




function loadThemes(classe_id, sequence_id)
{

     $.getJSON('/lessonapp/theme/ajax_get_themes/'+ sequence_id + '/' + classe_id + '/' , function(data) {
			     
	  if( data != null && data.length != 0 )
	  {	
	        $('#lessons_div').empty();
	        	     
		    
			   $('<ul />', {id: 'recipesList' + currentDiv}).appendTo('#lessons_div');
			   $.each(data, function(key, val) {
			     $('<a />', {
			      class: 'link',
			      href: '/lessonapp/read_theme/' + data[key]['id'],
			      text: data[key]['title']
			     }).appendTo($('<li />').appendTo('#recipesList' + currentDiv));
			   });
			         	   
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
			      class:'row'
			     }).appendTo('#container' + currentDiv);
			     
			   
			  
			 
			  /* add click event */
			  $('#classe_'+ data_classes[key2]['id']).click(function() {
			        
			  
			          loadThemes($(this).attr('id').substr(7), sequence_id);
				 
			   });
			 
			 
				 
		 }); 
		   
		 
		 
		 
		
		 $('#classesGrid' + currentDiv).show();
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
  

  /* update content */
  getContent(id,  choice, !reverse);

  /* slide-move */
  $('#container' + prevDiv).hide('drop', {direction: d1}, 200, function() {
    $('#container' + currentDiv).show('drop', {direction: d2}, 200);
     $('#container' + prevDiv).empty();
  });
}
