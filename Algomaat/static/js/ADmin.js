var currentDiv = 0;
$(function () { 


  getContent(1, true);
    
      
    }); 
    
    
 
 
 
 function addSessionContents(sequencesData, session_id)
 {

	if( sequencesData != null && sequencesData.length > 0 ) 
	{
		 $.each(sequencesData , function(key2, value) 
	 	 {
   content2 = '<a id="sequence"  class="btn btn-brand" href="/lessonapp/sequence/edit/'+ sequencesData[key2]['id'] +'"> Sequence '+ sequencesData[key2]['numero']  +'</a>';
	  content2 += '</br></br>';
	  $('#sessionContent_'+session_id).append(content2);
	  // $('#sequence').fadeIn('fast');
	 	 });
	 }
	 
 }
   
   
 function loadSequences()
 {
 	 $.ajax({
			    url: '/lessonapp/sequence/ajax_get_sessions_sequences_data/', 
			    dataType: 'json',
			    async: false,
			    type: 'GET',
			    success: function(data) 
			    {
			        
			           if( data != null && data.length > 0 ) 
	  			    {
			            
				    	 $('#sequencesContent').empty();
				    	 
				    	  $.each(data, function(key, value) {
				    	  
	  content = '<button id="session" class="accordion" style="width:60%;"> Session '+ data[key]["year"] + ' </button>';
	  
		  content += '<div id="sessionContent_'+ data[key]["id"]+'" class="panel"><br/>';	
		  
		  content += '</div>';
		  
		 
	 $('#sequencesContent').append(content);
	 
	 addSessionContents(data[key]["sequences"], data[key]["id"]);  
	 $('#session').fadeIn('fast');  			    	  
		                            
	                      				    	  
				    	  });
				      
				    }
				       
			   },
			   
			    error: function (xhr,textStatus,errorThrown) 
			    {

				  console.log("ERROR : ", errorThrown);
				  console.log("ERROR : ", xhr);
				  console.log("ERROR : ", textStatus);
			    }
		  });
 
 
 
 
 }
 
 
 
 function getContent(choice, reverse)
{   

	if( choice == 1 ) 
	{  
	 
		       /* create category list */
		       $('<ul />', {id: 'categoriesGrid' + currentDiv}).appendTo('#container' + currentDiv);
		      
			 $('<li />', {
			   class: 'ui-state-default',
			   id: 'user_admin',
			   text:" Users "
			 }).appendTo('#categoriesGrid' + currentDiv);
			 
			  $('<li />', {
			   class: 'ui-state-default',
			   id: 'pub_admin',
			   text:"Publications"
			 }).appendTo('#categoriesGrid' + currentDiv);
			 
			  $('<li />', {
			   class: 'ui-state-default',
			   id: 'space_admin',
			   text:"Spaces"
			 }).appendTo('#categoriesGrid' + currentDiv);
			 
			  $('<li />', {
			   class: 'ui-state-default',
			   id: 'event_admin',
			   text:"Events"
			 }).appendTo('#categoriesGrid' + currentDiv);




			 /* add click event */
			 $('#user_admin').click(function() {

			      slideTo(11, false);
			 });
		        $('#pub_admin').click(function() {
			      slideTo(12, false);
			 });
			 
			  $('#space_admin').click(function() {
			      slideTo(13, false);
			 });
			 
			 $('#event_admin').click(function() 
			 {
			            	slideTo(14, false);
				
			 });
			 
			  $('#options_title').click(function() {
			     slideTo(1, true);
			 });
		     

		     /* show list */
		     $('#categoriesGrid' + currentDiv).show();
 		
 		        /* hide loader */
			 $('#loader').fadeOut('fast');
		
		   
			      	
	      
	      
	}
	else if( choice == 11 ) 
	{

	         /* create category list */
		       $('<ul />', {id: 'categoriesGrid' + currentDiv}).appendTo('#container' + currentDiv);
		      
			 $('<li />', {
			   class: 'ui-state-default',
			   id: 'user_add',
			   text:" Add  "
			 }).appendTo('#categoriesGrid' + currentDiv);
			 
			  $('<li />', {
			   class: 'ui-state-default',
			   id: 'user_edit',
			   text:"Edit"
			 }).appendTo('#categoriesGrid' + currentDiv);
			 
			  $('<li />', {
			   class: 'ui-state-default',
			   id: 'user_delete',
			   text:"Delete"
			 }).appendTo('#categoriesGrid' + currentDiv);
			 
			  $('<li />', {
			   class: 'ui-state-default',
			   id: 'user_read',
			   text:"Read"
			 }).appendTo('#categoriesGrid' + currentDiv);

	          
	               /* show list */
    			 $('#categoriesGrid' + currentDiv).show();

	              
		     $('#options_icon').show();
	             $('#user_title').show();
	              $('#publication_title').hide();
	               $('#space_title').hide();
		         
	
		 	$('#user_add').click(function() 
			 {
				window.location.href = '/registration/admin_new_user/';
				
			 });
	
	      
	   
	}
	else if( choice == 3 ) 
	{
	    
	
	}
	else if( choice == 4 ) 
	{
	     
		         
	
	}
	
	


}
 
 
 
 
 
 function slideTo( choice, reverse) {
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
  $('#container' + prevDiv).empty();
  
 
  /* update content */
  if( choice != 1)
  {
  	getContent( choice, !reverse);
  }

  /* slide-move */
  $('#container' + prevDiv).hide('drop', {direction: d1}, 200, function() {
    $('#container' + currentDiv).show('drop', {direction: d2}, 200);
    //$('#container' + prevDiv).empty();
  });
}
 
 
 
 
