var NumberOfContents = 0;
var totalPrice = 0;
var panier_cart = {};
$(function () { 





    $('#tranche_mode_form').click(function(){
	     if ($(this).is(':checked')) 
	     {
	   	//tranche mode radio button is checked
	   	$('#button_form').show();
	  	$('#options_paiement_div').show();
	     }
   });
   
   
    $('#entier_mode_form').click(function(){
	     if ($(this).is(':checked')) 
	     {
	   	 //Entier mode radio button is checked
 	 	$('#options_paiement_div').hide();
 	 	$('#button_form').show();
	     }
   });

   


			if( localStorage.getItem('panier') == null )
		    	 {
		    		 panier_cart = {};
		    		        
			 }
		   	 else
		    	 {
		    		 panier_cart = JSON.parse(localStorage.getItem('panier'));
		    		 
		    	           		        
			 }
	
	
	


	 
		$.ajax({
		    url: '/bucket/ajax_get_cart_data', 
		    dataType: 'json',
		    async: false,
		    type: 'GET',
		    success: function(data) {
		              addBucket(data) 
			       
		   },
		   
		    error: function (xhr,textStatus,errorThrown) {
                              console.log("ERROR : ", errorThrown);
			       console.log("ERROR : ", xhr);
			       console.log("ERROR : ", textStatus);
		       }
		  });  
	
	          
	      	
 /*$('#close2').click(function(){
	 
              $(".modal-backdrop").remove();
	      $('#modal-pub-to-link').modal('hide');
	 });  
	   */
	   


    $('#convertToSpace').click(function(){
	 
	  $('#new-space-modal2').modal({ backdrop: true });
	  $('#new-space-modal2').modal('show');
	 
 	

  	});
              
                            
 

	
	
});





/**
 * Removes all occurences of the item from the array.
 *
 * Modifies the array “in place”, i.e. the array passed as an argument
 * is modified as opposed to creating a new array. Also returns the modified
 * array for your convenience.
 */
function removeInPlace(array, item) 
{
    var foundIndex, fromIndex;

    // Look for the item (the item can have multiple indices)
    fromIndex = array.length - 1;
    foundIndex = array.lastIndexOf(item, fromIndex);

    while (foundIndex !== -1) {
        // Remove the item (in place)
        array.splice(foundIndex, 1);

        // Bookkeeping
        fromIndex = foundIndex - 1;
        foundIndex = array.lastIndexOf(item, fromIndex);
    }

    // Return the modified array
    return array;
}




function deletePublicationFromInscriptionClick(eventObject) {
  
  divObj = $('#' + eventObject.currentTarget.id).parent().parent().parent().parent().parent();
  inscription_id = divObj.attr('id');
  
  participant_id = $('#participant_id_from_'+ inscription_id).val();
  
  publication_id = eventObject.currentTarget.id.substr(18);
  
  
  contentPrice =  $('#publicationPrice_'+ publication_id).val();
  url = "/bucket/remove/inscription/"+ inscription_id ;
 
 	
 $.getJSON(url, function(json) {
				 	     					
	if(json.success)
	{
	   
 $('#publication_' + publication_id ).hide('fast', function(){ 
		  	$(this).remove(); totalPrice = parseFloat(totalPrice) - parseFloat(contentPrice);
		  	
			$('#totalPrice').text(totalPrice.toString());  
			 
			  if( Array.isArray(panier_cart[publication_id]) )
			 	 {
					    if( panier_cart[publication_id].includes(participant_id) == true )
					     {
					           
						    removeInPlace(panier_cart[publication_id], participant_id);
						    
						    if( panier_cart[publication_id].length == 0 )
						    {
						         
						    	 delete panier_cart[publication_id];
						    }
			                localStorage.setItem('panier', JSON.stringify(panier_cart));
	    		   		document.getElementById("panier").innerHTML ="Cart("+ Object.keys(panier_cart).length+")";  
	    		   		AfficherList();
					     }
					       				
			 	 }
         
    
								});
		
	
               $('#total_of_pubs_'+ inscription_id).val(  $('#total_of_pubs_'+ inscription_id).val()  - 1 );
	    
	    	if( $('#total_of_pubs_'+ inscription_id).val() == 0 )
	    	{
	    		$('#' + inscription_id).remove();	
	    	}
	    	
				 	     						
        }
	else
	{
		
				 	     					  
        } 

  });    
  return false; 
  
}



function showParticipantName(participant_id)
{
 
	$.getJSON('/registration/ajax_get_user/'+participant_id, function(json) {
	   	
	     $('#participant_username_'+ participant_id ).text(json['username'].toString());
	    		 	     					
	    	
	});
	
   return false;
} 


function addBucket(data) 
{
	 if( data != null && data.length > 0 ) 
	 {
	    $.each(data, function(key, value) {

	             
		     space =  '<div id="' + data[key]["id"] + '"  class="container" style="background-color: #efefef; width:80%;  margin-bottom:50px;">';
				  
			      	 
		              // space += '<button id="buyBucket" style="width:80px; float:right; margin:10px;" class="btn btn-brand" >Buy</button>';
		              // space += '<button id="deleteParticipant_'+ data[key]['participant_id']+'" style="width:80px; float:right; margin:10px;" class="btn btn-brand bx bxs-trash" >   </button>';
		               
	space += '<input type="hidden" id="total_of_pubs_' + data[key]["id"] + '"  name="total_of_pubs" value="' + data[key]["publications"].length + '" />';
	
	
	space += '<input type="hidden" id="participant_id_from_' + data[key]["id"] + '"  name="participant_id_from' + data[key]["id"] + '" value="' + data[key]["participant"] + '" />';
				
				space += '<h4 id="participant_' + data[key]["participant"] + '" style="color:var(--brand);"> Participant: <span id="participant_username_'+ data[key]["participant"] +'" style=""> '+ data[key]["participant_name"]   +' </span> </h4>';
			      	space += '<br>';
				space  += '<div id="allContents" style=" padding-bottom:20px;" class="row g-4">';
								
								
								
					 	     		
			       space += '</div>';
		    space += '</div>';
		 
		
			$('#contentsOfBucket').prepend(space);   
			//showParticipantName(data[key]["participant"]);  
			addContentsBucket( data[key]["publications"]);
			$('#total').fadeIn('fast'); 
			
		
		});
	  }
  
}


function addContentsBucket(data) 
{

	$.each(data, function(key, value) {
		
	totalPrice =  parseFloat(totalPrice) + parseFloat(data[key]['price']); 
      
	content = '<div id="publication_'+ data[key]["id"] +'"  class="col-lg-4 col-md-6">';
		content += '<input type="hidden" id="publicationPrice_' + data[key]["id"] + '"  name="publicationPrice_' + data[key]["id"] + '" value="' + data[key]['price'] + '" />';
		
			 content +='<div class="service">';
				 	  		content +=' <img style="text-decoration:none;" src="/Algomaat/static/img/icon1.png" alt="">';
				 	     		content += '<h5 style="" >'+ data[key]["title"]  +'</h5>';
				 	     		
				 	     		
				 	     		
		 content += '<div  class="container" style="background-color: #DAD7CD; border-radius:10px; padding:10px; font-size:15px; font-weight:normal;  margin-bottom:10px;" >';
				 
						tagsData =  data[key]['liste_tags'] 
				 	     		 $.each(tagsData, function(tagkey, tagvalue) {
		content += '<span style="color:var(--brand);" > &nbsp; '+ tagsData[tagkey]['name'] +'</span>';
				 	     		});
						     		
						     		
		 content += '<div class="" style="background-color:#fff; color:var(--brand); border-radius:30px; font-size:17px; font-weight:normal; border-radius:0px; width:90%; margin:10px; padding:10px;">'
		
				   	     		
				content += '<p  style="font-family:Helvetica; font-size:13px; font-weight:lighter; color: #46494B;" class="mx-auto">'+  data[key]['description'] +'<p>';
			
			
				
			
			content += '</div>';	
			
				
			  	
			
		 content += '</div>';	     		
	
				 	     		
			
			
			
			content += '<div  class="container" style="background-color: #DAD7CD; border-radius:10px; padding:10px;   margin-bottom:10px;" >';
				
				     		
				 	   content += '<div class="" style="background-color:#fff; border-radius:30px; width:90%; margin:10px; padding:10px; font-size:18px; font-weight:normal; color:var(--brand); font-family:Helvetica;">'
			
	content += '<span class="" style=" " >'+ data[key]['price'] +' EUR </span>';
	                       
	                       
	
	  content += '<i  class=" bx bxs-cart" style="float:right; font-size:20px; font-weight:normal; margin:1px;" data-bs-toggle="" data-bs-target="" >  </i>';

			  		  content += ' </div>'
			  
			  
			content += '</div>';
		 	     		
							
				 			
				 	     		
			 content +='<div style="" margin:5 auto">';
				 	     	
content += '<span id="deletePublication_'+ data[key]['id']  +'"  class="btn btn-brand bx bxs-trash" style="margin:1px;" > </span>';
				 	     		        
		        content += '</div>';
				 	     		
				 	
				 	
				 	     		
			content += '</div>';
	content += '</div>';
				 	     	
				
				$('#allContents').prepend(content);
				$('#deletePublication_'+ data[key]['id'] ).click(deletePublicationFromInscriptionClick);
			  
			 	$('#publication_'+ data[key]["id"]).fadeIn('fast');   	                
				 	     			
		       			
	 
	 	 });
	 	 
	 	$('#totalPrice').text(totalPrice.toString());
	 	$('#totalPrice').fadeIn('fast'); 
	 	$('#totalPrice_form').val(totalPrice);

}

