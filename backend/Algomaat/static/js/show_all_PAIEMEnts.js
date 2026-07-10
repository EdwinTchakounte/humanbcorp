var NumberOfContents = 0;
$(function () { 
	 
		$.ajax({
		    url: '/paiement/ajax_get_all_paiements_data', 
		    dataType: 'json',
		    async: false,
		    type: 'GET',
		    success: function(data) {
		              
		              addPaiements(data) 
			       
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







function addContentsPaiement(Data)
{

		         if( Data != null && Data.length > 0 ) 
		         {
		         
		         	 $.each(Data , function(key2, value) 
	 	                 {

	 	                     var orderState = "Pending";
					if( Data[key2]["status"] == 2 )
					{
					   orderState = "Total Paid";
					}
					else if( Data[key2]["status"] == 3 )
					{
					   orderState = "Partially Paid";
					}
					else if( Data[key2]["status"] == 4 )
					{
					   orderState = "Failed";
					}
		        content =  '<div id="" class="container" style="background-color:#fff; width:97%; margin:10px;" >';        
                          content += '<h4 style=""> Order <span style="color:var(--brand); ">'+ orderState  +'</span></h4>';
                          content += '<span style="background-color:var(--brand); margin-bottom:5px; margin-left:20px; margin-top:-30px; padding:5px 5px; float:left; width:150px;  text-align:center; border-radius: 100px; font-size:12px; color: #fff; font-family:Helvetica;" ><b> By '+ Data[key2]["created_by_name"] +'</b></span>'
                           content += '<span style="background-color:var(--brand); width:150px;  margin-bottom:5px; margin-left:20px; margin-top:-30px; padding:5px 5px; float:right;  text-align:center; border-radius: 100px; font-size:12px; color: #fff; font-family:Helvetica;" > <b>'+ Data[key2]["totalOrderPrice"] +'FCFA </b></span>'
                             content += '<table style="background-color:#efefef; width:97%; margin:10px;" class="bordered-table zebra-striped">';
						content +='<thead>';
						content +='<tr>';
						//content +='<th> Order State </th>';
						content +='<th> Participant </th>';
						content +='<th>Publication</th>';
						content +='<th>Price</th>';
						content +='<th> State </th>';
						content +='<th> Calender </th>';
						content +='</tr>';
						content +='</thead>';
						content +='<tbody>';
		               
		         	
	 	                                       DataInscription =  Data[key2]["inscriptions"];
						  	$.each(DataInscription , function(key3, value) 
	 	                 			{
	 	                 				var inscriptionState = "Waiting";
	 	                 				if( DataInscription[key3]["status"] == 2)
	 	                 			        {
	 	                 			        	inscriptionState = "Confirmed";
	 	                 			        
	 	                 			        }
	 	                 			        else if( DataInscription[key3]["status"] == 3)
	 	                 			        {
	 	                 			        	inscriptionState = "Cancel";
	 	                 			        
	 	                 			        }
						  	content +='<tr>';
						  	//content +='<td>'+ orderState +'</td>';
						  	
						  	
						    		content +='<td>'+ DataInscription[key3]["participant_name"]  +'</td>';
						    		DataPublications = DataInscription[key3]["publications"];
						    		content += '<td>';
							  	$.each(DataPublications , function(key4, value) 
		 	                 			{ 
						    	          content +='<span>'+ DataPublications[key4]["title"] +'</span>';
						    		});
						    		content +='</td>';
						    		content += '<td>';
							  	$.each(DataPublications , function(key4, value) 
		 	                 			{ 
						    	          content +='<span>'+ DataPublications[key4]["price"] +'FCFA</span>';
						    	          
						    		});
						    		content +='</td>';
						    		content +='<td>'+ inscriptionState  +'</td>';
								
						    		content +='<td><span id=""  class="btn btn-brand bx bxs-calendar" style="margin:1px;" > </span> </td>';
						    	content +='</tr>';
						    	});
						    	        
						  	
			              
				 	//$('#delete_' + Data2[key3]["id"]).click(deleteLineClick);	     			
		       	 
						content +='</tbody>';
				content +='</table>';
				 
			     content +='</div>';
				$('#allContents').prepend(content);
				
				
		         	  });   
		         	 	
		         }

}





function addPaiements(data) 
{
	 if( data != null && data.length > 0 ) 
	 {
		     $.each(data , function(key, value) 
		     {
		 	paiement =  '<div id="paiement" class="container" style="background-color: #DAD7CD;  margin-bottom:50px;" >';
				  
			      	 
		              // paiement += '<button id="convertToSpace" style=" float:right; font-size:18px; margin:10px; display:none" data-bs-toggle="modal" data-bs-target="#new-space-modal2" class="btn btn-brand" > <i class="bx bxs-save"></i> <b>convert? </b> </button>';
			
				
				var tranche = "Premiere Tranche";
				if( data[key]["tranche"] == 2 )
				{
				   tranche = "Deuxieme Tranche";
				}
				else if( data[key]["tranche"] == 3 )
				{
				   tranche = "Troisieme Tranche";
				}
				
				if( data[key]["tranche"] == 4 )
				{
				    tranche = "Entier";
	
				}
				paiement += '<span class="btn btn-brand bx bxs-purchase-tag"  style="background-color:var(--brand); margin-bottom:5px;  margin-top:10px; padding:5px 5px; width:120px;  text-align:center; border-radius: 100px; font-size:12px; color: #fff; font-family:Helvetica;" ><b>'+ tranche +'</b></span>';
				
				paiement += '<h3 style="color:var(--brand);"> '+ data[key]["montant"]  +' FCFA / '+ data[key]["totalPrice"]  +' FCFA  </h3>';
				
				
			      	paiement += '<br>';
				paiement  += '<div id="allContents" style=" padding-bottom:20px;" class="row g-4">';
								
								
								
					 	     		
			       paiement += '</div>';
		    paiement += '</div>';
		 

			$('#contentsOfPaiements').prepend(paiement);    
			addContentsPaiement(data[key]["orders"]);   
			$('#paiement').fadeIn('fast'); 	
		 	
							
		    });
		
	  }
  
}




