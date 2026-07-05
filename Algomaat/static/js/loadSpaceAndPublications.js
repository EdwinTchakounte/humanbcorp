var getSpacesUrl;
var index = 0;
var allContentsInSpace = "";
participant_ids=[];
var modal_choice = 0;

$(function () { 


   // get_ajax_users_json('', '/registration/ajax_get_users', '', 0);
   
      $('#search_participants').empty();
         
		       /*  
				  $("input").keyup(function(){ 
				       if( modal_choice == 1 )
				       {  

						let value = $(this).val();
						//get_ajax_users_json('#search_participants', '/registration/ajax_get_users', value, 1);

			    		}
				  });
			*/
         
	       
	       if( $('#space_id').val() == 0 )
	       	getSpacesUrl = '/spaces/ajax_get_spaces_data/'+ $('#private').val() + '/' + $('#for_user').val()
	       else
	               getSpacesUrl = '/spaces/ajax_get_space_data/'+ $('#space_id').val();
	               
		$.ajax({
		    url: getSpacesUrl , 
		    dataType: 'json',
		    async: false,
		    type: 'GET',
		    success: function(data) {
		              $('#spaceContents').empty();
		              addSpacesPublications(data , 0) 
			       
		   },
		   
		    error: function (xhr,textStatus,errorThrown) {

				console.log("ERROR : ", errorThrown);
			       console.log("ERROR : ", xhr);
			       console.log("ERROR : ", textStatus);
		       }
		  });
	
	
	
	
	
	 $('#add_user_button').click(function()
	 {
	 
		   /* 
		      $('#show_user_register').slideUp();
		      if( isInputEmpty('#search_participants')   ) 
		      {
			  $('#search_participants').focus();
		      }
		 else if ( $.inArray($('#search_participants').val(), participants) == -1  && $.inArray($('#search_participants').val(),  allUsers) != -1 )
		      {
		      	  
		      	  addParticipantLine( 0,  $('#search_participants').val() , '#participants' );
		      	  participants.push($('#search_participants').val());
		      	  $('#search_participants').val('');
		      	  if( !$('#participants').is(':empty') )
		      	  {
		      	       $('#btn_add_participants_to_bucket').show();
		      	  }
		      }
		      
		      */
             
	 }); 
	 

	
});







// remove item from array
function remove(array, item){
    let ind = array.indexOf(item);
    if(ind !== -1)
        array.splice(ind, 1);
}




function addParticipantClick(eventObject) 
{
   id = eventObject.currentTarget.id.substr(22);
   
        var username = $('#select_participant_name_' + id).val();
 	if ( $.inArray(id.toString(), participant_ids) == -1 )
		      {
   			  addParticipantLine( id, username, '#participants' );
		      	  //participants.push(username);

		      	 
		      }
		     
  return false;
}


function addParticipantLine( id, name , selector )
{
   
     url= "/bucket/check_inscription_exist/"+ id +"/"+ $('#publication_id').val();
	$.getJSON(url, function(json) {
				     					
		if(json.success == false)
		{
			
						 
		         index = index + 1;   
			 userLine  = '<div id="participant_line_' + id + '" class="col-lg-10" >'; 
			 userLine += '<input type="hidden" name="participant_name_' + index + '" value="' + name + '" />';
			 userLine += '<input type="hidden" id="participantId_' + index + '" name="participantId_' + index + '" value="' + id + '" />';
			// userLine += '<span class="" style="padding:5px; font-size:20px; color:black;" id="text_' + name + '">' + name + '</span>';
			 userLine += '<button type="button" id="deleteParticipant_'+ id +'_'+ name +'" class="btn btn-brand bx bxs-trash" style=""> ' + name + ' </button>';
			 userLine  += '</div>'; 
			$(selector).prepend(userLine);
		    	
		    	participant_ids.push(id.toString());
		       $('#deleteParticipant_' + id +'_'+ name).click(deleteParticipantClick);
				 	     						
		}
		else
	        {
								  
		} 
				 	     				
				 	     				
	});				 	  
      
        
         
}


function deleteParticipantClick(eventObject) 
{
  
  divObj = $('#' + eventObject.currentTarget.id).parent();
  parentId = divObj.attr('id');
  //id =  $('#participantId_' + parentId).val()
  id = parentId.substr(17);

  divObj.hide('fast', function(){ $(this).remove();  remove(participant_ids, id.toString()); });
  
  return false;
}



function addNumberOfParticipants( index, selector )
{
   userLine = '<input type="hidden" name="index" value="' + index + '" />';
   $(selector).prepend(userLine);
   index = 0;
}

function loadPublications(getPublicationsUrl , id1) 
{
  $.getJSON(getPublicationsUrl, function(data) {
    	$('#contents_to_link').empty();
    	addSpacesPublications(data , id1);
  });  
}


function addSpacesPublications(data , id1) 
{

	
	  if( data != null && data.length > 0 ) 
	  {
	        
		    $.each(data, function(key, value) {
		    
		    
		    
 space =  '<div id="' + id1 +'_'+ data[key]["id"] + '" class="container" style="background-color: #efefef;  margin-bottom:50px;" >';

		         
		  if( $('#for_user').val() == 1)   	
		  {	          
		space += '<button id="edit_'+ id1 +'_' + data[key]["id"] +'" style="width:80px; float:right; margin:10px;" class="btn btn-brand" >Edit</button>';	 
              // space += '<button id="space_buy_'+ id1 +'_' + data[key]["id"] +'" style="width:80px; float:right; margin:10px;" class="btn btn-brand" >Buy</button>';
		 }
			
			space += '<h2> '+ data[key]["title"] +'</h2>';
		      	space += '<br>';
		       space += '<div id="allContents_'+ id1 +'_'+ data[key]["id"] +'" style=" padding-bottom:20px;" class="row g-4">';
							
							
							
				 	     		
		       space += '</div>';
 space += '</div>';
				 	     	
			
				 
				
			  if( id1 == 0 )
			   {	
				$('#spaceContents').prepend(space);
			   }
			   else
			   {
			   	$('#contents_to_link').prepend(space);
			   }
			     //$('#edit_' + id1 +'_' + data[key]["id"]).button({ icons: {primary: 'ui-icon-pencil'}, text: false });
				$('#' + id1 +'_' + data[key]["id"]).fadeIn('fast');   	                
				 	     			
		         $('#space_buy_' + id1 + '_' + data[key]["id"]).click(function(){
				
				  $('#space_to_buy_id').val(data[key]["id"]);
				  $('#publication_id').val(0);
				  $('#search_participants').val('');
				  $('#inscription_title').text(data[key]['title']);
				  show_modal('#modal-participant-to-add');
				 	     							 	     		
		         });	

		         addPublications(data[key]["publications"] , id1 , data[key]["id"]);	     			
			  		 
			 
	 		
	 
	 	 });
							
								
		
	  }
  
}





function create_child_of_publication(publication_id, publication_title, space_id)
{       
	$('#parent_publication_id').val(publication_id);
	$('#parent_publication_title').val(publication_title);
	$('#update_publication_title').text(publication_title);
	$('#space_id_of_child').val(space_id);

}




function addPublications(data, id1, spaceId)
{
	 if( data != null && data.length > 0 ) 
	 {
	 	 $.each(data, function(key, value) 
	 	   {

	 	       // link_content if id!=0  
	 	      if(  (id1)  || ( ( id1 == 0 ) && (($('#for_user').val() == 1) || ($('#for_user').val() == 0 && !data[key]['is_private'])) ) )
	 		 {
	 		 
	content = '<div id="content_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'"  class="col-lg-4 col-md-6">';
		   content +='<div   id="service_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'"  style="border-radius:10px;"  class="service">';
		   
		  if( $('#admin').val() )
		  {
		  	content += '<i data-bs-toggle="modal" data-bs-target="#modal-child-publication" ' +
    'onclick="create_child_of_publication(' + data[key]['id'] + ', \'' + data[key]['title'].replace(/'/g, "\\'") + '\', ' + spaceId + ');" ' +
    'class="bx bxs-calendar-plus" style="float:right; cursor:pointer; font-size:20px; font-weight:normal; margin:1px;"></i>';

		  
		  }
		  
		  
		  if(data[key]['categorie'] == 1)
		  {
	content +=' <img id="image_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'"  style="width:80px;" src="/static/img/iconeG.png" alt="">';
		  }
		  else if(data[key]['categorie'] == 2)
		  {
	content +=' <img id="image_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'"  style="width:80px;" src="/static/img/iconeI.png" alt="">';
		  }
		  else if(data[key]['categorie'] == 3)
		  {
	content +=' <img id="image_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'"  style="width:80px;" src="/static/img/iconeR.png" alt="">';
		  }
		   else if(data[key]['categorie'] == 4)
		  {
	content +=' <img id="image_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'"  style="width:80px;" src="/static/img/iconeD.png" alt="">';
		  }
		  else if(data[key]['categorie'] == 5)
		  {
	content +=' <img id="image_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'"  style="width:80px;" src="/static/img/iconeG.png" alt="">';
		  }
		  
	if ( data[key]['parent'] !== null) 
	{ 
		content += '<span style="color:var(--brand);" > CHILD </span>';	
	
	}
	content += '<h5 id="contentTitle_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'"   style="" ><a  style="text-decoration: none;" href="/publications/'+ spaceId + '/' + data[key]['id'] +'">'+ data[key]['title'] +'</a></h5>';
				 	     		
				 	     		
				 	     		
	       content += '<div id="infos_box_'+ id1 + '_' + spaceId + '_'+ data[key]['id'] +'" class="container" style="background-color:#DAD7CD; border-radius:10px; padding:10px; font-size:15px; font-weight:normal;  margin-bottom:10px;" >';
			 
			tagsData =  data[key]['liste_tags'];
				 	     	 $.each(tagsData, function(tagkey, tagvalue) {
		content += '<span style="" > &nbsp; '+ tagsData[tagkey]['name'] +'</span>';
				 	     		});
				 	     		
				 	     		
				     		
		 content += '<div id="infos_'+ id1 + '_' + spaceId + '_'+ data[key]['id'] +'" class="" style="background-color:#fff; color:var(--brand); border-radius:30px; font-size:17px; font-weight:normal; border-radius:0px; width:90%; margin:10px; padding:10px;">'
			
	 		content += '<p   id="description_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'" style="font-family:Helvetica; font-size:15px; font-weight:lighter; color: #46494B;" class="mx-auto">'+  data[key]['description'] +'<p>';
				 	
	        content += ' </div>';
	         if($('#for_user').val() == 1)
	         {
	           content += '<a  style="text-decoration: none; color:var(--brand);" href="/publications/'+ spaceId + '/' + data[key]['id'] +'"><span id="plus_dinfos_'+ id1 + '_' + spaceId + '_'+ data[key]['id'] +'"  style="margin:1px;" > Plus infos...  </span></a>';
		}
			  
			  
content += '</div>';

			
				 	     		
 content += '<input type="hidden" id="pubId_'+ id1 + '_' + spaceId +'" name="pubId_'+ id1 + '_' + spaceId +'" value="'+ data[key]['id'] +'">';
				 	     			 	     		
				 	     			 	     		
		content += '<div data-bs-toggle="modal" data-bs-target="#exampleModal"   class="container" style="background-color:#DAD7CD; border-radius:10px; padding:10px;   margin-bottom:10px;" >';
		
		content += '<span style="color:var(--brand);">&nbsp; Réservez un cours d\'essai gratuit</span>';

				
				     		
 content += '<div id="price_content_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'" class="" style="background-color:#fff; border-radius:30px; width:90%; margin:10px; padding:10px; font-size:20px; font-weight:normal; color:var(--brand); font-family:Helvetica;">'
				   
	content += '<span  id="price2_'+ id1 + '_' + spaceId + '_' + data[key]['id']+'" class="" style="font-size:17px; " >'+ data[key]['price'] +' EUR </span>';
	                     
	                      
	                       
	
	  content += '<i  class="bx bxs-cart" style="float:right; font-size:20px; font-weight:normal; margin:1px;"  >  </i>';

	

	
content += '</div>'
			  
			  
			content += '</div>';
	
	
	 	     		
				 	     		
				 	   		content +='<div style="" margin:5 auto">';
				 	     	if(id1)
				 	     	{
				 	     	 if($('#for_user').val() == 1)
				 	     	 {
				 	     	   content += '<span id="link_'+ id1 + '_' + spaceId + '_'+ data[key]['id'] +'"  class="btn btn-brand bx bxs-file" style="margin:1px;" > </span>';
				 	     	 }
				 	     		
				 	     	}
				 	     	else // id1 == 0
				 	     	{
				 	     	   if($('#for_user').val() == 1)
				 	     	   {
				 	     	   content += '<span id="link_'+ id1 + '_' + spaceId + '_'+ data[key]['id'] +'"  class="btn btn-brand bx bxs-file" style="margin:1px;"  data-bs-toggle="modal" data-bs-target="#modal-pub-to-link"> </span>';
				 	     	 
				 	     	//   content += '<span id="content_buy_'+ id1 + '_' + spaceId + '_'+ data[key]['id'] +'"  class="btn btn-brand bx bxs-cart" style="margin:1px;" data-bs-toggle="modal" data-bs-target="#modal-participant-to-add" >  </span>';

                                                           
				 	     	   content += '<span id="save_'+ id1 + '_' + spaceId + '_'+ data[key]['id'] +'"  class="btn btn-brand bx bxs-save"  style="margin:1px; " data-bs-toggle="modal" data-bs-target="#modal-memory">  </span>';
				 	     	   }
				 	     	   else 
				 	     	   {
 content +=' <a href="/publications/'+ spaceId + '/' + data[key]['id'] +'" style="color:#fff; margin:2px; padding:4px;  padding-bottom:7px; width:10%; background-color:var(--brand); text-decoration:none;  text-align:center; border-radius:5px;"> &nbsp; plus d infos... &nbsp; </a>';
                		 	     	   }
                		 	     	   
				 	     	}	
				 	     		
				 	     		        
				 	     		content += '</div>'; 
				 	     		
				 	     		

				content += '</div>';
				 	     	
				 	     		  
							  
								$('#allContents_' + id1 + '_' + spaceId).append(content);
							        $('#content_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).fadeIn('fast');
							
				 	     		
				 	     		
				 	     		$('#save_'+ id1 + '_' + spaceId + '_'+ data[key]['id']).click(function(){
				 	     		
				 	     		// save choice = 2
				 	     		 modal_choice = 2;
				 	     			
				 	     			id = data[key]['id'];
				 	     			url = "/bucket/add/publication/"+id;
				 	     				$.getJSON(url, function(json) {
				 	     					
				 	     					if(json.success)
				 	     					{
				 	     					       /* $('#modal-memory').modal({
														backdrop: true
													}) */
				 	     						$('#save-succes').show();
				 	     						$('#loader').hide();
				 	     						
				 	     					}
				 	     					else
				 	     					{
				 	     					  
				 	     					} 
				 	     				
				 	     				
				 	     				});				 	     			
				 	     		
				 	     		});
				 	     		
				 	     	
				 	     		$('#content_buy_'+ id1 + '_' + spaceId + '_'+ data[key]['id']).click(function(){
				 	     		        
				 	     		    
				 	     		 window.location = '/bucket/create/reservation/'+ data[key]['id'];
				 	     		       
				 	     		
				 	     							 	     		
				 	     		});
				 	     			
				 	     			
				 	     		$('#link_'+ id1 + '_' + spaceId + '_'+ data[key]['id']).click(function(){
				 	     		
				 	     		  
				 	     		//link choice = 3
				 	     		 modal_choice = 3;
				 	     		 
				 	     				$('#relation-failed').hide();
				 	     				$('#relation-succes').hide();
				 	     				 $('#loader').show();
				 	     				
				 	     				  if( id1 != 0 )
				 	     				  {
				 	     				     id2 = data[key]['id'];
				 	     				     url = "/relations/publications/"+id1+"/"+id2;
				 	     				  	$.getJSON(url, function(json) {
				 	     				  	             
												if(json.success)
												{
												     $('#relation-succes').show();
				 	     							     $('#loader').hide();
				 	     							     $('#relation-failed').hide();
													
												}
												 else 
												{
												     $('#relation-failed').show();
				 	     							     $('#loader').hide();
				 	     							     $('#relation-succes').hide();
														
												}
												
												 //$('#modal-pub-to-link').modal('hide');
						 	     		         });
						 	     			
						 	     		  }
						 	     		  else
						 	     		  {
						 	     		  
							 	     		/*  $('#modal-pub-to-link').modal({
											backdrop: true
										  }); */
										  
						 	     		  loadPublications("/spaces/ajax_get_spaces_data/0/1" , data[key]['id']);
						 	     		  	// $('#modal-pub-to-link').modal('show');	
						 	     		  
						 	     		  }
						 	     			
						 	 });  
						 	 
					 	 
				 	   
				 	          
				 $('#content_buy_'+ id1 + '_' + spaceId + '_'+ data[key]['id']).mouseenter(function() {
				 	      
				 	 $(this).css("cursor","pointer");
				 	$('#price2_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("color","#fff");
			  
				 	$('#price_content_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("color","#fff");
				 	$('#price_content_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("background-color","var(--brand)");
				
					      	      
				 	  });	
				 	  
				$('#content_buy_'+ id1 + '_' + spaceId + '_'+ data[key]['id']).mouseleave(function() {
		
				 	  $('#price2_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("color","var(--brand)");
			 	 
				 	  $('#price_content_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("color","var(--brand)");
				 	  $('#price_content_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("background-color","#fff");
				 	  
				 	   	      
				 	  });	
				 	  
				 	  
			
			      	          
				 $('#plus_dinfos_'+ id1 + '_' + spaceId + '_'+ data[key]['id']).mouseenter(function() {
				 	      
				 	$(this).css("cursor","pointer");
				 	$(this).css("color","#fff");
			  
				 	//$('#infos_box_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("color","#fff");
				 	$('#infos_box_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("background-color","var(--brand)");
				      	      
				 });	
				 
				  $('#plus_dinfos_'+ id1 + '_' + spaceId + '_'+ data[key]['id']).mouseleave(function() {
				 	      
				 	//$(this).css("cursor","pointer");
				 	$(this).css("color","var(--brand)");
			  
				 	//$('#infos_box_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("color","");
		$('#infos_box_'+ id1 + '_'+  spaceId + '_' + data[key]['id']).css("background-color","#DAD7CD");
				      	      
				 });	
				 
				 	     			
				 	     	
	 			
	 		
	              } // endif
	 	 });
	 
	 }
	
	
	
				 	   


}


