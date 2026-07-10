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
	
		     $('#add_session_div').hide();
	             $('#add_sequence_div').hide();
	              $('#edit_sequence_div').hide();
		         
		      
		       /* create category list */
		       $('<ul />', {id: 'categoriesGrid' + currentDiv}).appendTo('#container' + currentDiv);
		      
			 $('<li />', {
			   class: 'ui-state-default',
			   id: 'read_lessons',
			   text:" Read Lessons "
			 }).appendTo('#categoriesGrid' + currentDiv);
			 
			  $('<li />', {
			   class: 'ui-state-default',
			   id: 'new_session',
			   text:"Create new Session"
			 }).appendTo('#categoriesGrid' + currentDiv);
			 
			  $('<li />', {
			   class: 'ui-state-default',
			   id: 'new_sequence',
			   text:"Create new Sequence"
			 }).appendTo('#categoriesGrid' + currentDiv);
			 
			  $('<li />', {
			   class: 'ui-state-default',
			   id: 'edit_sequence',
			   text:"Edit Sequence"
			 }).appendTo('#categoriesGrid' + currentDiv);




			 /* add click event */
			 $('#read_lessons').click(function() {
			     window.location = '/lessonapp/read_lessons/';
			 });
		        $('#new_session').click(function() {
			      slideTo(2, false);
			 });
			 
			  $('#new_sequence').click(function() {
			      slideTo(3, false);
			 });
			 
			 $('#edit_sequence').click(function() 
			 {
			      	loadSequences()
			      	slideTo(4, false);
					var acc = document.getElementsByClassName("accordion");
					var i;
					for (i = 0; i < acc.length; i++) 
					{
					  acc[i].addEventListener("click", function() {
					    this.classList.toggle("active");
					    var panel = this.nextElementSibling;
					    if (panel.style.display === "block") {
					      panel.style.display = "none";
					    } else {
					      panel.style.display = "block";
					    }
					  });
					}
			      
			 });
			 
			  $('#options_title').click(function() {
			     slideTo(1, true);
			 });
		     

		     /* show list */
		     $('#categoriesGrid' + currentDiv).show();
 		
 		        /* hide loader */
			 $('#loader').fadeOut('fast');
		
		   
			      	
	      
	      
	}
	else if( choice == 2 ) 
	{
	      $('#add_session_div').show();
	             $('#add_sequence_div').hide();
	              $('#edit_sequence_div').hide();
	              
	              
		     $('#options_icon').show();
	             $('#new_session_title').show();
	              $('#new_sequence_title').hide();
	               $('#edit_sequence_title').hide();
		         
	
	
	}
	else if( choice == 3 ) 
	{
	      $('#add_session_div').hide();
	             $('#add_sequence_div').show();
	              $('#edit_sequence_div').hide();
	              
	                $('#options_icon').show();
	             $('#new_session_title').hide();
	              $('#new_sequence_title').show();
	               $('#edit_sequence_title').hide();
		         
	
	}
	else if( choice == 4 ) 
	{
	       $('#add_session_div').hide();
	             $('#add_sequence_div').hide();
	              $('#edit_sequence_div').show();
	              
	                $('#options_icon').show();
	             $('#new_session_title').hide();
	              $('#new_sequence_title').hide();
	               $('#edit_sequence_title').show();
		         
	
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
 // $('#container' + currentDiv).empty();
  
 
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
 
 
 
 
