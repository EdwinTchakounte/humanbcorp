var NumberOfContents = 0;
$(function () { 
	 
		$.ajax({
		    url: '/bucket/ajax_get_contents_data', 
		    dataType: 'json',
		    async: false,
		    type: 'GET',
		    success: function(data) {
		              
		              addSpaceBucket(data) 
			       
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
	
 	

  	});
              
                            
 

	
	
});


function deleteLineClick(eventObject) {
  divObj = $('#' + eventObject.currentTarget.id).parent().parent().parent();
  id = divObj.attr('id');

  url = "/bucket/remove/publication/"+id;
  $.getJSON(url, function(json) {
				 	     					
	if(json.success)
	{
	   
	    divObj.hide('fast', function(){ $(this).remove(); NumberOfContents--; });
	    if(NumberOfContents == 0)
	    {
	        $('#convertToSpace').hide();
	    	
	    }
				 	     						
        }
	else
	{
		
				 	     					  
        } 

  });
  return false;
}



function addSpaceBucket(data) 
{
	 if( data != null && data.length > 0 ) 
	 {
	 	space =  '<div id="space" class="container" style="background-color: #efefef;  margin-bottom:50px;" >';
		          
	              	 
                       space += '<button id="convertToSpace" style=" float:right; font-size:18px; margin:10px; display:none" data-bs-toggle="modal" data-bs-target="#new-space-modal2" class="btn btn-brand" > <i class="bx bxs-save"></i> <b>convert? </b> </button>';
		
			
			space += '<h3 style="color:var(--brand);"> Saved Publications </h3>';
		      	space += '<br>';
		        space  += '<div id="allContents" style=" padding-bottom:20px;" class="row g-4">';
							
							
							
				 	     		
		       space += '</div>';
            space += '</div>';
	 

		$('#contentsOfBucket').prepend(space);    
		addContentsBucket(data, data[0]["id"]);
		$('#space').fadeIn('fast'); 	
	 	
						
	    
		
	  }
  
}



function addContentsBucket(Data, spaceId)
{
          
		         if( Data != null && Data.length > 0 ) 
		         {       
		               $('#convertToSpace').show();
		               
		         	 $.each(Data , function(key2, value) 
	 	                 {
	 	                    Data2 = value["publications"];
	 	                    NumberOfContents  = Data2.length;

	 	                  $.each( Data2, function(key3, value3) 
	 	                  {
	 	                     
	 	                 
	content = '<div id="'+ Data2[key3]["id"] +'"  class="col-lg-4 col-md-6">';
		
		
   content +='<div class="service" style="border-radius:10px;" >';
				 	  		content +=' <img style="text-decoration:none;" src="/Algomaat/static/img/icon1.png" alt="">';
				 	     		content += '<h5 style="">'+ Data2[key3]["title"]  +'</h5>';
				 	     		
				 content += '<div  class="container" style="background-color: #DAD7CD; border-radius:10px; padding:10px; font-size:15px; font-weight:normal;  margin-bottom:10px;" >';
				 
						 tagsData =  Data2[key3]['liste_tags'] 
				 	     $.each(tagsData, function(tagkey, tagvalue) {
		content += '<span style="color:var(--brand);" > &nbsp; '+ tagsData[tagkey]['name'] +'</span>';
				 	     		}); 
						     		
						     		
		 content += '<div class="" style="background-color:#fff; color:var(--brand); border-radius:30px; font-size:17px; font-weight:normal; border-radius:0px; width:90%; margin:10px; padding:10px;">'
		
				   	     		
				content += '<p  style="font-family:Helvetica; font-size:13px; font-weight:lighter; color: #46494B;" class="mx-auto">'+  Data2[key3]['description'] +'<p>';
			
			
				
			
			content += '</div>';	
			
				
			  	
			
		 content += '</div>';	     		
	
  		 	     			 	     		
			content += '<div  class="container" style="background-color: #DAD7CD; border-radius:10px; padding:10px;   margin-bottom:10px;" >';
				
				     		
				 	   content += '<div class="" style="background-color:#fff; border-radius:30px; width:90%; margin:10px; padding:10px; font-size:15px; font-weight:normal; color:var(--brand); font-family:Helvetica;">'
			
	content += '<span class="" style=" " >'+ Data2[key3]['price'] +' FCFA </span>';
	                       
	                       
	
	  content += '<i  class=" bx bxs-cart" style="float:right; font-size:20px; font-weight:normal; margin:1px;" data-bs-toggle="" data-bs-target="" >  </i>';

	

	
			  		  content += ' </div>'
			  
			  
			content += '</div>';
	
			
  


				 	     
				 	      
				 	     			
				 	     		
				 	    content +='<div style="" margin:5 auto">';
				 	     	
	content += '<span id="delete_'+ Data2[key3]["id"] +'"  class="btn btn-brand bx bxs-trash" style="margin:1px;" > </span>';
				 	     				 	     		
				 	     		
				 	     		        
				 	    content += '</div>';
				 	     		
				 	    
				 	     		
			content += '</div>';
	content += '</div>';
				 	     	
				
				$('#allContents').prepend(content);
				$('#delete_' + Data2[key3]["id"]).click(deleteLineClick);
			  
			 	$('#'+ Data2[key3]["id"]).fadeIn('fast');   	                
				 	
				 	});	     			
		       	
		         	  });
		         }

}



